/*
Finished parts -> BOM material -> qualified purchase lines.
成品清单 -> BOM 原材料 -> 符合规则的采购 PO 明细。

Change only the requested part list below. Blank revision means blank revision.
This replaces the large customer-price-history/BOM/purchase-PO cross-join.
Customer selling prices will be connected separately from the price-review data.

Confirmed mapping rules:
  No BOM component part number: use the finished part itself.
  NULL component revision: use the finished part revision.
  Require operation Active = 1 and BOM Active = 1; exclude inactive BOM components.
Confirmed purchasing rules:
  Blanket_Order = 1; PO status = 'On Order'; line status excludes Cancelled / Closed (Requisition is allowed).
  Line effective / expiration dates must include @ReviewEndDate (inclusive; NULL = unbounded).
  Keep all qualifying lines; do not automatically pick the latest PO.

No cost/rate calculation or write-back is performed.
Read-only export; no purchase-price or standard-cost updates are performed.
*/
-- Select the same date as the website review period end.
-- REVIEW_END_START
DECLARE @ReviewEndDate DATE = CAST(GETDATE() AS DATE);
-- REVIEW_END_END

CREATE TABLE #RequestedParts (
    Part_No VARCHAR(100),
    Revision VARCHAR(100)
);

/* 在此增减成品及版本；每条 INSERT 对应一个待检查成品。 */
-- REQUESTED_PARTS_START
INSERT INTO #RequestedParts (Part_No, Revision) VALUES ('YOUR_FINISHED_PART', '');
-- REQUESTED_PARTS_END
-- INSERT INTO #RequestedParts (Part_No, Revision) VALUES ('ANOTHER-PART', '09');

SELECT P.Part_Key, P.Part_No, P.Revision
INTO #FinishedParts
FROM Part_v_Part AS P
WHERE EXISTS (
    SELECT 1
    FROM #RequestedParts AS R
    WHERE R.Part_No = P.Part_No
      AND CASE WHEN LEN(LTRIM(RTRIM(COALESCE(CAST(P.Revision AS VARCHAR(100)), '')))) = 1
                    AND LTRIM(RTRIM(CAST(P.Revision AS VARCHAR(100)))) LIKE '[0-9]'
               THEN '0' + LTRIM(RTRIM(CAST(P.Revision AS VARCHAR(100))))
               ELSE LTRIM(RTRIM(COALESCE(CAST(P.Revision AS VARCHAR(100)), ''))) END
          = CASE WHEN LEN(LTRIM(RTRIM(COALESCE(R.Revision, '')))) = 1
                      AND LTRIM(RTRIM(R.Revision)) LIKE '[0-9]'
                 THEN '0' + LTRIM(RTRIM(R.Revision))
                 ELSE LTRIM(RTRIM(COALESCE(R.Revision, ''))) END
);

WITH Scoped_BOM AS (
    SELECT
        B.Part_Key AS Finished_Part_Key,
        B.Part_Operation_Key,
        O.Operation_No,
        B.Quantity AS BOM_Quantity,
        B.Active AS BOM_Active,
        C.Part_Key AS Component_Part_Key,
        C.Part_No AS Component_Part_No,
        C.Revision AS Component_Revision
    FROM Part_v_BOM AS B
    JOIN #FinishedParts AS F ON F.Part_Key = B.Part_Key
    LEFT JOIN Part_v_Part_Operation AS O
        ON O.Part_Operation_Key = B.Part_Operation_Key
    LEFT JOIN Part_v_Part AS C ON C.Part_Key = B.Component_Part_Key
    WHERE O.Active = 1
      AND B.Active = 1
)
SELECT
    F.Part_Key AS FG_Part_Key,
    F.Part_No AS FG_Part_No,
    F.Revision AS FG_Revision,
    B.Part_Operation_Key,
    B.Operation_No,
    B.BOM_Quantity,
    B.BOM_Active,
    CASE WHEN B.Component_Part_No IS NULL
         THEN F.Part_Key ELSE B.Component_Part_Key END AS Material_Part_Key,
    CASE WHEN B.Component_Part_No IS NULL
         THEN F.Part_No ELSE B.Component_Part_No END AS Material_Part_No,
    CASE WHEN B.Component_Revision IS NULL
         THEN F.Revision ELSE B.Component_Revision END AS Material_Revision,
    CASE WHEN B.Component_Part_No IS NULL
         THEN 'Finished part fallback' ELSE 'BOM component' END AS Mapping_Source,
    CASE WHEN B.Component_Revision IS NULL
         THEN 'Finished revision fallback' ELSE 'Component revision' END AS Revision_Source
INTO #MaterialMap
FROM #FinishedParts AS F
LEFT JOIN Scoped_BOM AS B ON B.Finished_Part_Key = F.Part_Key;

SELECT
    I.Part_Key AS Material_Part_Key,
    I.Plexus_Customer_No AS PCN,
    P.PO_Key AS Purchase_PO_Key,
    P.PO_No AS Purchase_PO_No,
    P.PO_Type AS Purchase_PO_Type,
    P.PO_Date AS Purchase_PO_Date,
    P.Blanket_Order,
    PS.PO_Status AS Purchase_PO_Status,
    I.Line_Item_Key AS Purchase_Line_Item_Key,
    I.Line_Item_No AS Purchase_Line_Item_No,
    LS.Line_Item_Status,
    P.Supplier_No,
    S.Supplier_Code,
    S.Supplier_Status,
    P.Currency_Code AS Purchase_Currency,
    I.Unit AS Price_Unit,
    I.Order_Unit,
    I.Price_Conversion,
    I.Unit_Price AS Purchase_Unit_Price,
    I.Effective_Date AS Line_Effective_Date,
    I.Expiration_Date AS Line_Expiration_Date,
    P.INCO_Terms_Key,
    P.Blanket_Effective_Date2 AS Blanket_End_Date
INTO #QualifiedPurchaseLines
FROM Purchasing_v_Line_Item AS I
JOIN Purchasing_v_PO AS P
    ON P.PO_Key = I.PO_Key
   AND P.Plexus_Customer_No = I.Plexus_Customer_No
JOIN Purchasing_v_PO_Status AS PS ON PS.PO_Status_Key = P.PO_Status_Key
JOIN Purchasing_v_Line_Item_Status AS LS
    ON LS.Line_Item_Status_Key = I.Line_Item_Status_Key
   AND LS.Plexus_Customer_No = I.Plexus_Customer_No
LEFT JOIN Common_v_Supplier AS S ON S.Supplier_No = P.Supplier_No
WHERE EXISTS (
    SELECT 1 FROM #MaterialMap AS M WHERE M.Material_Part_Key = I.Part_Key
)
  AND P.Blanket_Order = 1
  AND PS.PO_Status = 'On Order'
  AND UPPER(LTRIM(RTRIM(LS.Line_Item_Status))) NOT IN ('CANCELLED', 'CANCELED', 'CLOSED')
  AND (I.Effective_Date IS NULL OR CAST(I.Effective_Date AS DATE) <= @ReviewEndDate)
  AND (I.Expiration_Date IS NULL OR CAST(I.Expiration_Date AS DATE) >= @ReviewEndDate);

SELECT Material_Part_Key, COUNT(*) AS Qualified_PO_Line_Count
INTO #PurchaseCounts
FROM #QualifiedPurchaseLines
GROUP BY Material_Part_Key;

SELECT
    M.FG_Part_Key,
    M.FG_Part_No,
    M.FG_Revision,
    M.Part_Operation_Key,
    M.Operation_No,
    M.BOM_Quantity,
    M.BOM_Active,
    M.Material_Part_Key,
    M.Material_Part_No,
    M.Material_Revision,
    M.Mapping_Source,
    M.Revision_Source,
    COALESCE(C.Qualified_PO_Line_Count, 0) AS Qualified_PO_Line_Count,
    CASE WHEN C.Qualified_PO_Line_Count IS NULL THEN 'No qualifying purchase line'
         WHEN C.Qualified_PO_Line_Count = 1 THEN 'One qualifying purchase line'
         ELSE 'Multiple qualifying purchase lines' END AS Match_Result,
    P.PCN,
    P.Purchase_PO_Key,
    P.Purchase_PO_No,
    P.Purchase_PO_Type,
    P.Purchase_PO_Date,
    P.Blanket_Order,
    P.Purchase_PO_Status,
    P.Purchase_Line_Item_Key,
    P.Purchase_Line_Item_No,
    P.Line_Item_Status,
    P.Supplier_No,
    P.Supplier_Code,
    P.Supplier_Status,
    P.Purchase_Currency,
    P.Price_Unit,
    P.Order_Unit,
    P.Price_Conversion,
    P.Purchase_Unit_Price,
    P.Line_Effective_Date,
    P.Line_Expiration_Date,
    P.INCO_Terms_Key,
    P.Blanket_End_Date
FROM #MaterialMap AS M
LEFT JOIN #QualifiedPurchaseLines AS P ON P.Material_Part_Key = M.Material_Part_Key
LEFT JOIN #PurchaseCounts AS C ON C.Material_Part_Key = M.Material_Part_Key
ORDER BY M.FG_Part_No, M.FG_Revision, M.Operation_No,
         M.Material_Part_No, P.Purchase_PO_No, P.Purchase_Line_Item_No;

DROP TABLE #PurchaseCounts;
DROP TABLE #QualifiedPurchaseLines;
DROP TABLE #MaterialMap;
DROP TABLE #FinishedParts;
DROP TABLE #RequestedParts;
