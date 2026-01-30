// Code.gs - Google Apps Script Web App endpoint
// Deploy as: Execute as "Me", Who has access: "Anyone"

/**
 * Handles POST requests from the Event Logger web app.
 * Supports both application/x-www-form-urlencoded and application/json content types.
 * 
 * @param {Object} e - The event object containing request data
 * @returns {ContentService.TextOutput} JSON response { ok: boolean }
 */
function doPost(e) {
  try {
    let params = {};
    
    // Parse parameters based on content type
    if (e.postData.type === 'application/x-www-form-urlencoded') {
      // Simple request format (no preflight)
      params = e.parameter;
    } else if (e.postData.type === 'application/json') {
      // JSON format (if headers were set)
      params = JSON.parse(e.postData.contents);
    } else {
      throw new Error('Unsupported content type: ' + e.postData.type);
    }
    
    // Validate required parameters
    if (!params.event || !params.userId || !params.ts) {
      throw new Error('Missing required parameters');
    }
    
    // Prepare row data for the sheet
    const timestamp = new Date(parseInt(params.ts));
    const rowData = [
      timestamp.toISOString(),          // ts_iso
      params.event,                     // event
      params.variant || '',             // variant
      params.userId,                    // userId
      params.meta || ''                 // meta (already stringified)
    ];
    
    // Append to the "logs" sheet
    const sheet = getOrCreateLogSheet();
    sheet.appendRow(rowData);
    
    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Log error and return failure response
    console.error('Error in doPost:', error);
    return ContentService
      .createTextOutput(JSON.stringify({ 
        ok: false, 
        error: error.message 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Gets or creates the "logs" sheet with appropriate headers.
 * 
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The logs sheet
 */
function getOrCreateLogSheet() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  let sheet;
  
  if (spreadsheetId) {
    // Use specified spreadsheet
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    sheet = spreadsheet.getSheetByName('logs');
    if (!sheet) {
      sheet = spreadsheet.insertSheet('logs');
      initSheetHeaders(sheet);
    }
  } else {
    // Use current spreadsheet (default)
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    sheet = spreadsheet.getSheetByName('logs');
    if (!sheet) {
      sheet = spreadsheet.insertSheet('logs');
      initSheetHeaders(sheet);
    }
  }
  
  return sheet;
}

/**
 * Initializes the sheet with column headers.
 * 
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to initialize
 */
function initSheetHeaders(sheet) {
  const headers = [
    'ts_iso',      // ISO 8601 timestamp
    'event',       // Event type (cta_click, heartbeat)
    'variant',     // A/B variant (if applicable)
    'userId',      // Pseudo user ID
    'meta'         // JSON string with metadata
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Freeze header row and set basic formatting
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground('#f0f0f0')
    .setFontWeight('bold');
    
  // Set column widths
  sheet.setColumnWidth(1, 180); // ts_iso
  sheet.setColumnWidth(2, 100); // event
  sheet.setColumnWidth(3, 80);  // variant
  sheet.setColumnWidth(4, 120); // userId
  sheet.setColumnWidth(5, 300); // meta
}

/**
 * Optional: For testing via GET requests
 */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ 
      status: 'ready',
      instructions: 'Send POST requests with event data'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Deployment instructions:
// 1. Save this script in Google Apps Script editor
// 2. Deploy as Web App:
//    - Execute as: "Me"
//    - Who has access: "Anyone"
// 3. Use the latest deployment URL (ends with /exec)
// 4. Optional: Set SPREADSHEET_ID in script properties to use a specific spreadsheet