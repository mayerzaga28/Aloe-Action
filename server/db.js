import pg from 'pg';
let pool;
export function database(){
 if(!process.env.DATABASE_URL) throw Object.assign(new Error('La tienda todavía no está conectada.'),{status:503});
 return pool ||= new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,ssl:process.env.DB_LOCAL==='true'?false:{rejectUnauthorized:true}});
}
export async function transaction(db,fn){const c=await db.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
