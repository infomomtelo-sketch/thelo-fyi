/*
  1. Go to script.google.com
  2. Paste this
  3. Run createTheloSheet()
  4. Copy URL into /data/config.js
*/

function createTheloSheet() {
  const sheetName = "thelo-fyi LIVE";
  const headers = ["id", "name", "address", "beds_available", "care_level", "phone", "last_updated"];
  const rows = [
    [1, "Fresno Garden House", "1234 N Cedar Ave, Fresno, CA 93703", 2, "RCFE", "(559) 555-0101", "2026-09-10T00:00:00Z"],
    [2, "Fig Garden Care", "4567 W Shaw Ave, Fresno, CA 93711", 0, "RCFE", "(559) 555-0102", "2026-09-10T00:00:00Z"],
    [3, "Central Valley Retreat", "7890 E Olive Ave, Fresno, CA 93720", 1, "RCFE", "(559) 555-0103", "2026-09-10T00:00:00Z"]
  ];

  const files = SpreadsheetApp.getActiveSpreadsheet ? null : null;
  const spreadsheet = SpreadsheetApp.create(sheetName);
  const sheet = spreadsheet.getSheets()[0];
  sheet.setName(sheetName);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.autoResizeColumns(1, headers.length);

  const csv = [headers.join(",")].concat(rows.map(row => row.map(value => {
    const text = String(value);
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }).join(","))).join("\n");

  const file = DriveApp.getFileById(spreadsheet.getId());
  const published = file.getUrl();
  Logger.log("Sheet created: " + published);
  Logger.log("CSV preview:\n" + csv);
  return published;
}
