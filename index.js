const puppeteer = require('puppeteer-core');
const getData = require('./get_data_from_database.js');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const prompt = require('prompt-sync')({ sigint: true });

(async () => {

    const username = prompt('Please enter your Infor username: ');
    const password = prompt('Password: ');


    console.log('Retrieving data from database...')
    let data = await getData()
        .then(data => {
            console.log('Data was successfully retrieved.');
            // return(data.slice(0, 1000));
            return(data);
        })
        .catch(error => console.error(error));

    const browser = await puppeteer.launch({
        channel: 'chrome',
        headless: false
    });

    const csvWriter = createCsvWriter({
        path: 'output.csv',
        header: [
            {id: 'barcode', title: 'barcode'},
            {id: 'SKU', title: 'SKU'},
            {id: 'Infor_Number', title: 'Infor_Number'},
            {id: 'product_name', title: 'product_name'},
            {id: 'keyword_UPC', title: 'keyword_UPC'},
            {id: 'menu items', title: 'menu items'}
        ]
    });


    try {
        // Open browser
        const pages = await browser.pages();
        const page = pages[0]; // Use the first page (index 0) in the array
        await page.goto('http://emweb.hpo.inforcloudsuite.com/');

        // Get login containers
        const username_box = '#username';
        const password_box = '#password';
        const company_box = '#company';


        let success = false;
        while (!success) {
            try {
                await page.waitForSelector('#username');
                await page.waitForSelector('#password');
                await page.waitForSelector('#company');
        
                // Clear the fields before typing the values
                await page.click(username_box, { clickCount: 3 });
                await page.keyboard.press('Backspace');
                await page.type(username_box, username);
        
                await page.click(password_box, { clickCount: 3 });
                await page.keyboard.press('Backspace');
                await page.type(password_box, password);
        
                await page.click(company_box, { clickCount: 3 });
                await page.keyboard.press('Backspace');
                await page.type(company_box, 'byu');
        
                // Check if the username box has text
                const usernameValue = await page.$eval('#username', el => el.value);
                if (usernameValue.trim() !== '') {
                    success = true;
                } else {
                    console.error('Login unsuccessful. No text in username box. Trying again...');
                }
            } 
            catch (error) {
                console.error('Login unsuccessful. Trying again...');
            }
        }

        // Click Login
        await Promise.all([
            page.click('body > div > form > div.login_submit > a'),
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            console.log('Login successful!')
        ]);

        // Click the dropdown
        await page.click('#header > section.top-nav.clearfix.ng-scope > form > div > a');
        // Wait for the dropdown to appear
        await page.waitForSelector('#header > section.top-nav.clearfix.ng-scope > form > div > div > ul');

        // Click on Keyword/UPC
        await new Promise(resolve => setTimeout(resolve, 500));
        await page.click('#header > section.top-nav.clearfix.ng-scope > form > div > div > ul > li:nth-child(4)');

        let csvData = [];

        // Keyword/UPC Search
        for (let i = 0; i < data.length; i++) { //TODO: change to data.length
            console.log(data[i]);
            // Search SKU
            await page.waitForSelector('#editorFilter');
            const search_bar = await page.$('#editorFilter');
            await search_bar.type(data[i].SKU);
            await page.keyboard.press('Enter');

            if (i == 0) {
                await page.waitForNavigation({ waitUntil: 'networkidle0' });
            }

            await page.waitForSelector('#keywordUPCDiv > section > article > div.table-responsive > table > tbody > tr');
            const locks = await page.evaluate(() => {
                const rows = document.querySelectorAll('#keywordUPCDiv > section > article > div.table-responsive > table > tbody > tr');
                let locks = [];
                for (let row of rows) {
                    locks.push(row.childNodes[1].id);
                }
                return locks;
            });

            await page.waitForSelector('#keywordUPCDiv > section > article > div.table-responsive > table > tbody > tr > td:nth-child(6) > button.button_storesettings');

            const currentInforNumber = data[i].Infor_Number;

            for (let j = 0; j < locks.length; j++) {
                if (locks[0] == currentInforNumber) {
                    await page.evaluate((j) => {
                        const button = document.querySelector(`#keywordUPCDiv > section > article > div.table-responsive > table > tbody > tr:nth-child(${j + 1}) > td:nth-child(6) > button.button_storesettings`);
                        button.click();
                    }, j);

                    await page.waitForSelector('#keywordUPCDiv > section.panel.panel-default.row > article > div.table-responsive > table > tbody > tr:nth-child(1) > td:nth-child(4) > input');
                    // await page.waitForSelector('#keywordUPCDiv > section.panel.panel-default.row > article > div.menu-div > button.button_savechanges');

                    let changesMade = await page.evaluate(() => {
                        let changesMade = false;

                        // Click active checkboxes
                        let table = document.querySelector("#keywordUPCDiv > section.panel.panel-default.row > article > div.table-responsive > table > tbody");
                        let rows = table.childNodes;
                        let numRows = table.childNodes.length - 2;
            
                        for (let k = 2; k < numRows; k += 2) {
                            if (rows[k].childNodes[7].childNodes[0].checked) {
                                rows[k].childNodes[7].childNodes[0].click();
                                console.log("Changes made");
                                changesMade = true;

                            }
                            else {
                                console.log("Changes not made");
                            }
                        }

                        return changesMade;
                    });

                    if (changesMade) {
                        await page.evaluate((selector) => {
                            const element = document.querySelector(selector);
                            element.scrollIntoView();
                            element.click();
                            window.history.back();
                        }, '#keywordUPCDiv > section.panel.panel-default.row > article > div.menu-div > button.button_savechanges');    

                        console.log("Changes Made")
                    }
                    else {
                        await page.evaluate(() => {
                            window.history.back();
                        });

                        console.log("Changes not Made");
                    }
                    
                    await page.waitForSelector('#keywordUPCDiv > section > article > div.table-responsive > table > tbody > tr > td:nth-child(6) > button.button_storesettings');
                }

                let newlocks = await page.evaluate(() => {
                    const rows = document.querySelectorAll('#keywordUPCDiv > section > article > div.table-responsive > table > tbody > tr');
                    let locks = [];
                    for (let row of rows) {
                        locks.push(row.childNodes[1].id);
                    }
                    return locks;
                });

                locks.length = newlocks.length; // Adjust for increasing or decreasing locks upon returning to previous page
                if (j >= locks.length) {
                    j = 0;
                }
            }

            csvData.push({
                barcode: data[i].barcode,
                SKU: data[i].SKU,
                Infor_Number: data[i].Infor_Number,
                product_name: data[i].product_name,
                keyword_UPC: "Completed",
            });

            console.log('Item ' + (i + 1) + '/' + data.length + ' deactivated');
        }


        // Click the dropdown
        await page.click('#header > section.top-nav.clearfix.ng-scope > form > div > a');
        // Wait for the dropdown to appear
        await page.waitForSelector('#header > section.top-nav.clearfix.ng-scope > form > div > div > ul');

        // Click on Menu Items
        await new Promise(resolve => setTimeout(resolve, 500));
        await page.click('#header > section.top-nav.clearfix.ng-scope > form > div > div > ul > li:nth-child(1)');


        // // Menu Items Search
        // for (let i = 0; i < data.length; i++) { //TODO: change to data.length
        //     console.log(data[i]);
        //     // Search SKU
        //     await page.waitForSelector('#editorFilter');
        //     const search_bar = await page.$('#editorFilter');
        //     await search_bar.type(data[i].SKU);
        //     await page.keyboard.press('Enter');

        //     if (i == 0) {
        //         await page.waitForNavigation({ waitUntil: 'networkidle0' });
        //     }

        //     await page.waitForSelector('#quickAddMenuItemsDiv > section:nth-child(3) > article:nth-child(4) > div.table-responsive > table > tbody');
        //     const locks = await page.evaluate(() => {
        //         const rows = document.querySelectorAll('#quickAddMenuItemsDiv > section:nth-child(3) > article:nth-child(4) > div.table-responsive > table > tbody > tr');
        //         let locks = [];
        //         for (let row of rows) {
        //             locks.push(row.childNodes[1].id);
        //             console.log(row);
        //         }
        //         return locks;
        //     });

        //     await page.waitForSelector('#quickAddMenuItemsDiv > section:nth-child(2) > article:nth-child(4) > article > div.table-responsive > table > tbody > tr > td:nth-child(18) > div > button');

        //     const currentInforNumber = data[i].Infor_Number;

        //     for (let j = 0; j < locks.length; j++) {
        //         document.querySelector(body[0]).scrollLeft  = 500;

        //         if (locks[0] == currentInforNumber) {
        //             await page.evaluate((j) => {
        //                 const button = document.querySelector(`#quickAddMenuItemsDiv > section:nth-child(2) > article:nth-child(4) > article > div.table-responsive > table > tbody > tr > td:nth-child(${j + 18}) > div > button`);
        //                 document.querySelector(body[0]).scrollLeft  = 500;

        //                 button.click();
        //             }, j);


        //             await page.waitForSelector('#keywordUPCDiv > section.panel.panel-default.row > article > div.table-responsive > table > tbody > tr:nth-child(1) > td:nth-child(4) > input');
        //             // await page.waitForSelector('#keywordUPCDiv > section.panel.panel-default.row > article > div.menu-div > button.button_savechanges');

        //             let changesMade = await page.evaluate(() => {
        //                 let changesMade = false;

        //                 // Click active checkboxes
        //                 let table = document.querySelector("#keywordUPCDiv > section.panel.panel-default.row > article > div.table-responsive > table > tbody");
        //                 let rows = table.childNodes;
        //                 let numRows = table.childNodes.length - 2;
            
        //                 for (let k = 2; k < numRows; k += 2) {
        //                     if (rows[k].childNodes[7].childNodes[0].checked) {
        //                         rows[k].childNodes[7].childNodes[0].click();
        //                         console.log("Changes made");
        //                         changesMade = true;

        //                     }
        //                     else {
        //                         console.log("Changes not made");
        //                     }
        //                 }

        //                 return changesMade;
        //             });

        //             if (changesMade) {
        //                 await page.evaluate((selector) => {
        //                     const element = document.querySelector(selector);
        //                     element.scrollIntoView();
        //                     element.click();
        //                     window.history.back();
        //                 }, '#keywordUPCDiv > section.panel.panel-default.row > article > div.menu-div > button.button_savechanges');    

        //                 console.log("Changes Made")
        //             }
        //             else {
        //                 await page.evaluate(() => {
        //                     window.history.back();
        //                 });

        //                 console.log("Changes not Made");
        //             }
                    
        //             await page.waitForSelector('#keywordUPCDiv > section > article > div.table-responsive > table > tbody > tr > td:nth-child(6) > button.button_storesettings');
        //         }

        //         let newlocks = await page.evaluate(() => {
        //             const rows = document.querySelectorAll('#keywordUPCDiv > section > article > div.table-responsive > table > tbody > tr');
        //             let locks = [];
        //             for (let row of rows) {
        //                 locks.push(row.childNodes[1].id);
        //             }
        //             return locks;
        //         });

        //         locks.length = newlocks.length; // Adjust for increasing or decreasing locks upon returning to previous page
        //         if (j >= locks.length) {
        //             j = 0;
        //         }
        //     }

        //     csvData.push({
        //         barcode: data[i].barcode,
        //         SKU: data[i].SKU,
        //         Infor_Number: data[i].Infor_Number,
        //         product_name: data[i].product_name,
        //         keyword_UPC: "Completed",
        //     });

        //     console.log('Item ' + (i + 1) + '/' + data.length + ' deactivated');
        // }

        console.log(csvData);
        // write the data to the csv file
        csvWriter.writeRecords(csvData)
            .then(() => {
                console.log('CSV file written successfully');
            })
            .catch((err) => {
                console.log(err);
            });

        console.log('All items deactivated.')
        await browser.close();

    } 
    catch(error) {
        console.log('There was an error and the browser has disconnected.\n');
        console.log(error);
        await browser.close();
    }
})();