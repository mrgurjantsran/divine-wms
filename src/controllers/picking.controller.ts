// import { Request, Response } from 'express';
// import { query } from '../config/database';
// import { generateBatchId } from '../utils/helpers';


// // ====== GET SOURCE BY WSN (QC → INBOUND → MASTER) ======
// export const getSourceByWSN = async (req: Request, res: Response) => {
//   try {
//     const { wsn, warehouseId } = req.query;
//     if (!wsn || !warehouseId) {
//       return res.status(400).json({ error: 'WSN and warehouse ID required' });
//     }

//     // QC TABLE
//     let sql = `SELECT q.*, 'QC' as source FROM qc q WHERE q.wsn = $1 AND q.warehouse_id = $2 LIMIT 1`;
//     let result = await query(sql, [wsn, warehouseId]);

//     if (result.rows.length === 0) {
//       // INBOUND TABLE
//       sql = `SELECT i.*, 'INBOUND' as source FROM inbound i WHERE i.wsn = $1 AND i.warehouse_id = $2 LIMIT 1`;
//       result = await query(sql, [wsn, warehouseId]);

//       if (result.rows.length === 0) {
//         // MASTER_DATA TABLE - ONLY WSN (NO warehouse_id like QC/Inbound pattern)
//         sql = `SELECT m.*, 'MASTER' as source FROM master_data m WHERE m.wsn = $1 LIMIT 1`;
//         result = await query(sql, [wsn]);
        
//         if (result.rows.length === 0) {
//           return res.status(404).json({ error: 'WSN not found in QC, Inbound or Master Data' });
//         }
//       }
//     }

//     res.json(result.rows[0]);
//   } catch (error: any) {
//     console.error('Get source by WSN error:', error);
//     res.status(500).json({ error: 'Failed to fetch data' });
//   }
// };


// // ====== MULTI PICKING ENTRY ======
// export const multiPickingEntry = async (req: Request, res: Response) => {
//   try {
//     const { entries, warehouse_id } = req.body;
//     const userId = (req as any).user?.id;
//     const userName = (req as any).user?.fullName || 'Unknown';

//     if (!entries || entries.length === 0) {
//       return res.status(400).json({ error: 'No entries provided' });
//     }

//     // Get warehouse name
//     const whSql = `SELECT name FROM warehouses WHERE id = $1`;
//     const whResult = await query(whSql, [warehouse_id]);
//     const warehouseName = whResult.rows[0]?.name || '';

//     const wsns = entries.map((e: any) => e.wsn).filter(Boolean);

//     // Check existing WSNs
//     const existingMap = new Map<string, number>();
//     if (wsns.length > 0) {
//       const checkSql = `SELECT wsn, warehouse_id FROM picking WHERE wsn = ANY($1)`;
//       const checkRes = await query(checkSql, [wsns]);
//       checkRes.rows.forEach((row: any) => {
//         existingMap.set(row.wsn, row.warehouse_id);
//       });
//     }

//     const batchId = generateBatchId('MULTI');
//     let successCount = 0;
//     const results: any[] = [];

//     for (const entry of entries) {
//       const wsn = entry.wsn?.trim();
//       if (!wsn) continue;

//       // Duplicate check
//       if (existingMap.has(wsn)) {
//         results.push({ wsn, status: 'DUPLICATE', message: 'WSN already picked' });
//         continue;
//       }

//       const sql = `
//         INSERT INTO picking (
//           wsn, picking_date, picker_name, customer_name, header_remarks,
//           picking_remarks, product_serial_number, source, batch_id, warehouse_id, warehouse_name,
//           wid, fsn, product_title, brand, mrp, fsp, hsn_sac, igst_rate,
//           cms_vertical, fkt_link, rack_no, qc_date, qc_by, qc_remarks,
//           inbound_date, vehicle_no, unload_remarks, order_id, fkqc_remark, fk_grade,
//           invoice_date, wh_location, vrp, yield_value, p_type, p_size, created_by, created_user_name
//         ) VALUES (
//           $1,$2,$3,$4,$5, $6,$7,$8,$9,$10, $11,$12,$13,$14,$15, $16,$17,$18,$19,$20,
//           $21,$22,$23,$24,$25, $26,$27,$28,$29,$30, $31,$32,$33,$34,$35, $36,$37,$38,$39
//         )
//       `;

//       await query(sql, [
//         wsn, entry.picking_date, entry.picker_name, entry.customer_name, entry.header_remarks,
//         entry.picking_remarks, entry.product_serial_number, entry.source, batchId, warehouse_id, warehouseName,
//         entry.wid, entry.fsn, entry.product_title, entry.brand, entry.mrp, entry.fsp, entry.hsn_sac, entry.igst_rate,
//         entry.cms_vertical, entry.fkt_link, entry.rack_no, entry.qc_date, entry.qc_by, entry.qc_remarks,
//         entry.inbound_date, entry.vehicle_no, entry.unload_remarks, entry.order_id, entry.fkqc_remark, entry.fk_grade,
//         entry.invoice_date, entry.wh_location, entry.vrp, entry.yield_value, entry.p_type, entry.p_size, userId, userName
//       ]);

//       results.push({ wsn, status: 'SUCCESS' });
//       successCount++;
//     }

//     res.json({
//       batchId,
//       totalCount: entries.length,
//       successCount,
//       results
//     });
//   } catch (error: any) {
//     console.error('Multi Entry ERROR:', error);
//     res.status(500).json({ error: error.message });
//   }
// };


// // ====== GET PICKING LIST ======
// export const getPickingList = async (req: Request, res: Response) => {
//   try {
//     const {
//       page = 1,
//       limit = 100,
//       search = '',
//       warehouseId,
//       source = '',
//       customer = ''
//     } = req.query;

//     const offset = (Number(page) - 1) * Number(limit);

//     let whereConditions: string[] = [];
//     const params: any[] = [];
//     let paramIndex = 1;

//     if (warehouseId) {
//       whereConditions.push(`p.warehouse_id = $${paramIndex}`);
//       params.push(warehouseId);
//       paramIndex++;
//     }

//     if (search) {
//       whereConditions.push(`(
//         p.wsn ILIKE $${paramIndex} OR 
//         p.product_title ILIKE $${paramIndex} OR
//         p.brand ILIKE $${paramIndex}
//       )`);
//       params.push(`%${search}%`);
//       paramIndex++;
//     }

//     if (source) {
//       whereConditions.push(`p.source = $${paramIndex}`);
//       params.push(source);
//       paramIndex++;
//     }

//     if (customer) {
//       whereConditions.push(`p.customer_name ILIKE $${paramIndex}`);
//       params.push(`%${customer}%`);
//       paramIndex++;
//     }

//     const whereClause = whereConditions.length > 0 
//       ? `WHERE ${whereConditions.join(' AND ')}` 
//       : '';

//     const countSql = `SELECT COUNT(*) as total FROM picking p ${whereClause}`;
//     const countResult = await query(countSql, params);
//     const total = parseInt(countResult.rows[0].total);

//     const dataSql = `
//       SELECT p.*
//       FROM picking p
//       ${whereClause}
//       ORDER BY p.created_at DESC
//       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
//     `;
//     params.push(Number(limit), offset);

//     const result = await query(dataSql, params);

//     res.json({
//       data: result.rows,
//       total,
//       page: Number(page),
//       limit: Number(limit),
//       totalPages: Math.ceil(total / Number(limit))
//     });
//   } catch (error: any) {
//     console.error('Get picking list error:', error);
//     res.status(500).json({ error: error.message });
//   }
// };


// // ====== GET CUSTOMERS LIST ======
// export const getCustomers = async (req: Request, res: Response) => {
//   try {
//     const { warehouseId } = req.query;

//     const sql = `
//       SELECT DISTINCT customer_name
//       FROM picking
//       WHERE warehouse_id = $1
//       AND customer_name IS NOT NULL
//       AND customer_name != ''
//       ORDER BY customer_name
//     `;

//     const result = await query(sql, [warehouseId]);

//     res.json(result.rows.map(r => r.customer_name));
//   } catch (error: any) {
//     console.error('Get customers error:', error);
//     res.status(500).json({ error: error.message });
//   }
// };


// // ====== CHECK WSN EXISTS IN PICKING ======
// export const checkWSNExists = async (req: Request, res: Response) => {
//   try {
//     const { wsn, warehouseId } = req.query;

//     const result = await query(
//       'SELECT id FROM picking WHERE wsn = $1 AND warehouse_id = $2',
//       [wsn, warehouseId]
//     );

//     res.json({
//       exists: result.rows.length > 0,
//       id: result.rows[0]?.id
//     });
//   } catch (error: any) {
//     console.error('Check WSN error:', error);
//     res.status(500).json({ error: error.message });
//   }
// };


// // ====== GET ALL EXISTING WSNS IN PICKING ======
// export const getExistingWSNs = async (req: Request, res: Response) => {
//   try {
//     const { warehouseId } = req.query;

//     const result = await query(
//       'SELECT wsn FROM picking WHERE warehouse_id = $1',
//       [warehouseId]
//     );

//     res.json(result.rows.map(r => r.wsn));
//   } catch (error: any) {
//     console.error('Get existing WSNs error:', error);
//     res.status(500).json({ error: error.message });
//   }
// };

import { Request, Response } from 'express';
import { query } from '../config/database';

export const getSourceByWSN = async (req: Request, res: Response) => {
  try {
    const { wsn, warehouseId } = req.query;
    if (!wsn || !warehouseId) {
      return res.status(400).json({ error: 'WSN and warehouse ID required' });
    }

    // 1. Check QC
    let sql = `SELECT q.*, 'QC' as source FROM qc q WHERE q.wsn = $1 AND q.warehouse_id = $2 LIMIT 1`;
    let result = await query(sql, [wsn, warehouseId]);

    if (result.rows.length === 0) {
      // 2. Check Inbound
      sql = `SELECT i.*, 'INBOUND' as source FROM inbound i WHERE i.wsn = $1 AND i.warehouse_id = $2 LIMIT 1`;
      result = await query(sql, [wsn, warehouseId]);

      if (result.rows.length === 0) {
        // 3. Check Master Data (NO warehouse_id filter)
        sql = `SELECT m.*, 'MASTER' as source FROM master_data m WHERE m.wsn = $1 LIMIT 1`;
        result = await query(sql, [wsn]);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'WSN not found' });
        }
      }
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const multiPickingEntry = async (req: Request, res: Response) => {
  try {
    const { entries, warehouse_id } = req.body;
    const userId = (req as any).user?.id || 1;
    const userName = (req as any).user?.fullName || 'System';

    if (!entries || entries.length === 0) {
      return res.status(400).json({ error: 'No entries' });
    }

    let successCount = 0;
    for (const entry of entries) {
      const wsn = entry.wsn?.trim();
      if (!wsn) continue;

      const sql = `INSERT INTO picking (wsn, picking_date, picker_name, source, warehouse_id, created_by, created_user_name, created_at) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`;
      
      await query(sql, [wsn, entry.picking_date, entry.picker_name, entry.source, warehouse_id, userId, userName]);
      successCount++;
    }

    res.json({ successCount, totalCount: entries.length });
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getPickingList = async (req: Request, res: Response) => {
  try {
    const sql = `SELECT * FROM picking ORDER BY created_at DESC LIMIT 100`;
    const result = await query(sql, []);
    res.json({ data: result.rows, total: result.rows.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getCustomers = async (req: Request, res: Response) => {
  try {
    res.json([]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const checkWSNExists = async (req: Request, res: Response) => {
  try {
    const { wsn } = req.query;
    const sql = `SELECT id FROM picking WHERE wsn = $1 LIMIT 1`;
    const result = await query(sql, [wsn]);
    res.json({ exists: result.rows.length > 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getExistingWSNs = async (req: Request, res: Response) => {
  try {
    const sql = `SELECT wsn FROM picking`;
    const result = await query(sql, []);
    res.json(result.rows.map((r: any) => r.wsn));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
