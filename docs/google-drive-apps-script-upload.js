const UPLOAD_TOKEN = "change-this-token";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    if (UPLOAD_TOKEN && payload.token !== UPLOAD_TOKEN) {
      return json({ error: "Invalid upload token" }, 403);
    }

    const folder = DriveApp.getFolderById(payload.folderId);
    if (payload.action === "createPdf") {
      const sourceName = String(payload.fileName || "bill.pdf").replace(/\.pdf$/i, ".html");
      const htmlBlob = Utilities.newBlob(payload.html || "", "text/html", sourceName);
      const pdfBlob = htmlBlob.getAs(MimeType.PDF).setName(payload.fileName || "bill.pdf");
      const pdfFile = folder.createFile(pdfBlob);

      return json({
        id: pdfFile.getId(),
        name: pdfFile.getName(),
        url: pdfFile.getUrl()
      });
    }

    const bytes = Utilities.base64Decode(payload.data);
    const blob = Utilities.newBlob(bytes, payload.mimeType || "application/octet-stream", payload.fileName || "bill-upload");
    const file = folder.createFile(blob);

    return json({
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl()
    });
  } catch (error) {
    return json({ error: error && error.message ? error.message : String(error) }, 400);
  }
}

function json(body, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
