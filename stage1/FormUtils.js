// Retrieves an item within a form by type, and optionally title if disambiguation needed.
function findFormItem_(form, type, title = null) {
  items = form.getItems(type);
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 0 || title === null) {
    throw new Error(`Unexpected number of items ${items.length}`);
  }
  const item = items.find(item => item.getTitle() == title);
  if (item === null) {
    throw new Error(`Item with title "${title}" not found.`);
  }
  return item;
}

// Converts a Google Workspace document to .docx.
// This is necessary; blob.getAs() does not know how to export to .docx.
// Returns the converted blob.
function convToWord_(file) {
    const url = 'https://www.googleapis.com/drive/v3/files/' + file.getId() + '/export?mimeType=' + MimeType.MICROSOFT_WORD;
  const response = UrlFetchApp.fetch(url, {
    headers: {'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()},
  })
  return response.getBlob();

  // Attempt to use the adavned drive API (v2) we use in the other function:
  // (doesn't seem to work because Google's API is broken:
  // https://stackoverflow.com/q/42887569/5719930)
  // const response = Drive.Files.export(file.getId(), MimeType.MICROSOFT_WORD);
  // return response.getBlob();
}

// Converts a Google-Docs-compatible document to .pdf
// This is necessary; blob.getAs() does not understand these inputs. 
function convToPdf_(file) {
  const response = Drive.Files.insert({
    mimeType: MimeType.GOOGLE_DOCS,
    title: file.getName(),
    parents: [{id: tmpFolder.getId()}]
  }, file.getBlob());

  const convFile = DriveApp.getFileById(response.id);
  convFile.setTrashed(true);

  return convFile.getBlob().getAs(MimeType.PDF);
}

// Performs any needed file conversions on a file blob.
// Returns:
//  - The original file blob.
//  - The converted file blob (if applicable).
// Conversion table:
//    .pdf    Returns [Original file blob, null]
//    .docx   Returns [Original file blob, PDF convert]
//    .doc    Returns [Original file blob, null] (conversion not possible through the API)
//    .dotx   ^
//    GDoc    Returns [.docx convert, PDF convert]
// The user must do the following for a complete data set:
//    - Copy over the PDFs to the conversion folder.
//    - Convert the files for which conversion could not automatically be performed.
// Other functions may assume that the convert format is PDF.
function processFile_(file) {
  // MimeType: https://developers.google.com/apps-script/reference/base/mime-type
  const blob = file.getBlob();
  // Uncomment to disable conversion:
  // return [blob, null];
  const mimeType = file.getMimeType();
  switch (mimeType) {
    case MimeType.PDF: // .pdf
      return [blob, null];
    case MimeType.MICROSOFT_WORD: // .docx
    case MimeType.MICROSOFT_WORD_LEGACY: // .doc
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.template': // .dotx (template)
      return [blob, convToPdf_(file)];
    case MimeType.GOOGLE_DOCS: // Google Doc
      return [convToWord_(file), blob.getAs(MimeType.PDF)];
      console.error(`Unable to convert ${file.getName()} (${mimeType})`);
      return [blob, null];
    default:
      throw new Error(`Unsupported MIME type ${mimeType}: "${file.getName()}")`);
  }
}

// Changes the name of the blobs to follow a normalized format.
function normalizeBlobNames_(origBlob, convBlob, fullName) {
  const origExtension = origBlob.getName().split('.').pop();
  origBlob.setName(`${fullName} Resume.${origExtension}`);
  if (convBlob !== null) {
    convBlob.setName(`${fullName} Resume.pdf`);
  }
}
