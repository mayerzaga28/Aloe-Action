import fs from 'node:fs/promises';import {database} from '../server/db.js';
if(process.env.CONFIRM_MIGRATION!=='test-database-reviewed')throw Error('Review the target database and set CONFIRM_MIGRATION=test-database-reviewed. Production requires a separate approved release.');
if(process.env.PAYMENT_MODE==='live')throw Error('Production migration is not enabled by this command.');
const db=database();try{await db.query(await fs.readFile(new URL('../migrations/001_commerce.sql',import.meta.url),'utf8'));console.log('Migration applied; draft catalog inactive with zero stock.');}finally{await db.end();}
