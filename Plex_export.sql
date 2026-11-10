/*
Customer price export / 客户价格底表导出
Includes complete price history, PO metadata, current active Releases and cumulative Shipped.
导出完整价格历史、PO信息、当前有效 Releases 和累计 Shipped；可用下方前缀参数缩小范围。
Price = PR.Price. Components are retained for review, not summed into the price.
售价直接取PR.Price，组件数量仅供核对。
Keep full price history including inactive prices. Price_Active is current state, not historical state.
请保留完整价格历史，在网页工具中选择检查期间。
Blanket type key 2500 is validated for PCN 269388.
*/

DECLARE @BlanketPOTypeKey INT = 2500;
DECLARE @SpotBuyPOTypeKey INT = 2501;
DECLARE @PartFilter VARCHAR(100) = '';
DECLARE @CustomerFilter VARCHAR(100) = '';
DECLARE @CustomerPartFilter VARCHAR(100) = '';
DECLARE @PartStatusFilter VARCHAR(1000) = '';

SET @PartStatusFilter = ',' + @PartStatusFilter + ',';

/* 第一步：先按PO明细和Ship-to汇总，再生成原有的PO明细总量。
   GM分支使用Ship-to数量；其他客户保持原有PO明细汇总规则。
   此金额/数量是当前状态，不是指定历史期间的快照。
*/
SELECT
    R.po_line_key,
    R.ship_to,
    SUM(R.quantity) AS Releases
INTO #ReleaseByPOLineShipTo
FROM sales_v_release AS R
JOIN sales_v_po_line AS POL
    ON POL.po_line_key = R.po_line_key
JOIN sales_v_po AS PO
    ON PO.po_key = POL.po_key
JOIN sales_v_po_status AS POS
    ON POS.po_status_key = PO.po_status_key
JOIN common_v_customer AS C
    ON C.customer_no = PO.customer_no
JOIN common_v_customer_address AS CA
    ON CA.customer_address_no = R.ship_to
JOIN common_v_customer_status AS CS
    ON CS.customer_status = C.customer_status
JOIN sales_v_release_status AS RS1
    ON RS1.release_status_key = R.release_status_key
JOIN part_v_part AS P
    ON P.part_key = POL.part_key
WHERE CS.active = 1
  AND CA.active = 1
  AND POS.active = 1
  AND RS1.active = 1
GROUP BY R.po_line_key, R.ship_to;

SELECT po_line_key, SUM(Releases) AS Releases
INTO #ReleaseByPOLine
FROM #ReleaseByPOLineShipTo
GROUP BY po_line_key;

/* Cumulative shipped quantity per PO line / 每条 PO 明细累计发货数量。
   Keep completed/inactive releases; shipment totals must not use active-release filtering.
   Decimal shipment quantity takes precedence where present.
   Validated against Customer Orders and the user 2026-10-26 export: 0 / 3192.
*/
SELECT
    R.po_line_key,
    SUM(COALESCE(R.Quantity_Shipped_DEC, R.Quantity_Shipped, 0)) AS Shipped
INTO #ShippedByPOLine
FROM sales_v_release AS R
JOIN sales_v_po_line AS POL ON POL.po_line_key = R.po_line_key
JOIN part_v_part AS P ON P.part_key = POL.part_key
WHERE P.part_no LIKE @PartFilter + '%'
GROUP BY R.po_line_key;

/* GM approved Ship-to mappings. Each price is intentionally repeated once per
   distinct approved Ship-to; non-GM rows retain their original granularity.
   地址状态保留供工具核对；缺失/非Active地址不会被假定为正常。
*/
SELECT DISTINCT
    PST.po_line_key,
    PST.ship_to AS Ship_To_Key,
    CA.customer_address_code AS Ship_To_Code,
    CASE WHEN CA.active = 1 THEN 1 WHEN CA.active = 0 THEN 0 ELSE NULL END AS Ship_To_Active
INTO #GMShipTo
FROM sales_v_po_ship_to AS PST
JOIN sales_v_po_line AS POL ON POL.po_line_key = PST.po_line_key
JOIN sales_v_po AS PO ON PO.po_key = POL.po_key
JOIN common_v_customer AS C ON C.customer_no = PO.customer_no
LEFT JOIN common_v_customer_address AS CA ON CA.customer_address_no = PST.ship_to
WHERE C.customer_code IN ('GMNA', 'GM-NA 1', 'GMCCA', 'GM Canada SPO', 'GM Henniges', 'GM Henniges SPO');

/* 第二步：计算每条价格关联的非Shipment Price组件行数。
   同样每个price_key只生成一条记录，不使主查询扩行。
*/
SELECT
    PC.price_key,
    COUNT(*) AS Component_Count
INTO #PriceComponentCounts
FROM sales_v_price_component AS PC
JOIN sales_v_price_type AS PT
    ON PT.price_type_key = PC.price_type_key
WHERE PT.price_type NOT IN ('Shipment Price')
GROUP BY PC.price_key;

/* 第三步：价格历史作为输出明细，与已汇总的Release连接。
   不按本月筛掉历史价格：旧价及尚未失效的早期价格也要参与判断。
*/
SELECT
    'CST' AS Seeling_Company,
    PO.PCN AS PCN,
    PO.po_key,
    POL.po_line_key,
    PR.price_key,
    C.customer_code,
    PO.po_no,
    PO.PO_Date AS PO_Date,
    PO.PO_Type_Key AS PO_Type_Key,
    CASE WHEN PO.PO_Type_Key = @BlanketPOTypeKey THEN 'Blanket'
         WHEN PO.PO_Type_Key = @SpotBuyPOTypeKey THEN 'Spot Buy'
         ELSE 'Other' END AS PO_Type,
    P.part_key,
    P.part_no AS Minth_Part_No,
    P.name AS Minth_Part_Name,
    P.part_type AS Program,
    P.revision,
    P.part_status,
    CP.customer_part_no,
    CP.customer_part_revision,
    PR.Price AS Price,
    PR.Price AS Raw_Price,
    PR.active AS Price_Active,
    COALESCE(PCC.Component_Count, 0) AS Component_Count,
    CASE
        WHEN COALESCE(PCC.Component_Count, 0) <> 1 THEN 1
        ELSE 0
    END AS Component_Needs_Review,
    PR.unit,
    CU.currency_code,
    PR.effective_date,
    PR.expiration_date,
    COALESCE(RL.Releases, 0) AS Releases,
    COALESCE(SHP.Shipped, 0) AS Shipped,
    GST.Ship_To_Key,
    GST.Ship_To_Code,
    GST.Ship_To_Active,
    CASE WHEN GST.Ship_To_Key IS NOT NULL THEN COALESCE(SRL.Releases, 0) ELSE NULL END AS Ship_To_Releases
FROM sales_v_po_line AS POL
JOIN part_v_part AS P
    ON P.part_key = POL.part_key
JOIN part_v_customer_part AS CP
    ON CP.customer_part_key = POL.customer_part_key
JOIN sales_v_po AS PO
    ON PO.po_key = POL.po_key
JOIN sales_v_po_status AS POS
    ON POS.po_status_key = PO.po_status_key
JOIN sales_v_price AS PR
    ON PR.po_line_key = POL.po_line_key
JOIN common_v_currency AS CU
    ON CU.currency_key = PR.currency_key
JOIN common_v_customer AS C
    ON C.customer_no = PO.customer_no
LEFT JOIN #ReleaseByPOLine AS RL
    ON RL.po_line_key = POL.po_line_key
LEFT JOIN #ShippedByPOLine AS SHP
    ON SHP.po_line_key = POL.po_line_key
LEFT JOIN #PriceComponentCounts AS PCC
    ON PCC.price_key = PR.price_key
LEFT JOIN #GMShipTo AS GST
    ON GST.po_line_key = POL.po_line_key
LEFT JOIN #ReleaseByPOLineShipTo AS SRL
    ON SRL.po_line_key = POL.po_line_key AND SRL.ship_to = GST.Ship_To_Key
WHERE CP.active = 1
  AND POS.active = 1
  AND POL.active = 1
  AND PO.master_price = 0
  AND C.customer_code LIKE @CustomerFilter + '%'
  AND CP.customer_part_no LIKE @CustomerPartFilter + '%'
  AND P.part_no LIKE @PartFilter + '%'
  AND (
        @PartStatusFilter = ',,'
        OR CHARINDEX(',' + CAST(P.part_status AS VARCHAR(40)) + ',', @PartStatusFilter) > 0
      )
ORDER BY P.part_no, C.customer_code, PO.po_no, POL.po_line_key, GST.Ship_To_Key, PR.effective_date, PR.price_key;

DROP TABLE #PriceComponentCounts;
DROP TABLE #ReleaseByPOLine;
DROP TABLE #ShippedByPOLine;
DROP TABLE #ReleaseByPOLineShipTo;
DROP TABLE #GMShipTo;

