const sql = require('mssql');

async function getData() {
    const config = {
        user: 'EatecDM',
        password: '2cF0@BEAnJo2fOR',
        server: 'SSVS413',
        port: 1433,
        database: 'EatecX',
        encrypt: false
    };
      
    // create a function to connect to the database and run a query
    async function runQuery(query) {
        try {
            // create a new connection pool with the configuration
            const pool = await sql.connect(config);
        
            // create a new request object for the query
            const request = new sql.Request();
        
            // run the query and get the result
            const result = await request.query(query);
        
            // return the result as an array of objects
            return result.recordset;
        
        } catch (err) {
            console.error('Error running query', err);
        }
    }
    
    let query = `SELECT ingbarcodes.number as barcode, products.number as SKU, pl.number as Infor_Number, products.id as product_name
        FROM prolookups pl JOIN zassociations zas on pl.location = zas.intnum JOIN zetup08 zet on zas.linkitem = zet.intnum
        inner join products on pl.item=products.intnum
        inner join ingredients on products.linkitem = ingredients.intnum
        inner join ingbarcodes on ingredients.intnum = ingbarcodes.item
        where products.id like 'zzz%' and products.linkdb = 1;`;
      
    // example usage: connect to the database and select all rows from a table
    try {
        const result = await runQuery(query);
        return result.map(item => ({
            barcode: item.barcode.replace(/^z+/, '').trim(),
            SKU: item.SKU.replace(/^z+/, '').trim(),
            Infor_Number: item.Infor_Number.trim(),
            product_name: item.product_name.replace(/^z+/, '').trim()
        }));
    } catch (error) {
        console.error(error);
    }
}

module.exports = getData;
