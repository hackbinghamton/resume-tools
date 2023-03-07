// Extracts all of the resume blobs from the responses of a form.
// Updates in-place the known names/emails, and populates the blob arrays.
function processForm_(form, knownNames, knownEmails, origBlobs, convBlobs) {
  // Form: https://developers.google.com/apps-script/reference/forms/form
  console.info(`Processing form "${form.getTitle()}"...`);

  // At this point, the forms *should* be closed.
  if (form.isAcceptingResponses()) {
    console.warn(`Form \"${form.getTitle()}\" is accepting responses!`);
  }

  const resumeItem = findFormItem_(form, FormApp.ItemType.FILE_UPLOAD);
  const fullNameItem = findFormItem_(form, FormApp.ItemType.TEXT, 'Full Name');

  for (const response of form.getResponses()) {
    const email = response.getRespondentEmail();
    if (blocklist.process(email)) {
      console.info(`Skipping ${email}.`);
      continue;
    }

    const fullNameInput = response.getResponseForItem(fullNameItem).getResponse();
    const fullName = nameFixup_(fullNameInput, email);

    if (knownNames.has(fullName)) {
      console.warn(`More than one entry with name "${fullName}".`);
    }
    knownNames.add(fullName);
    if (knownEmails.has(email)) {
      console.warn(`More than one entry with email "${email}".`);
    }
    knownEmails.add(email);

    const resumeId = response.getResponseForItem(resumeItem).getResponse();
    const file = DriveApp.getFileById(resumeId);
    const [origBlob, convBlob] = processFile_(file);
    normalizeBlobNames_(origBlob, convBlob, fullName);
    origBlobs.push(origBlob);
    if (convBlob !== null) {
      convBlobs.push(convBlob);
    }
  }
}

function main() {
  // Initialize blob arrays (see FormUtils.gs for conversion info).

  // The blobs of all of the original files.
  const origBlobs = [];
  // The blobs of all of the converted files, if applicable.
  // Size will be no larger than that of the original file set.
  // Size may be zero if conversion is disabled in the other scrpt.
  const convBlobs = [];

  // Initialize duplicate entry detection.

  // All names which we have processed so far.
  // False positives are very possible.
  const knownNames = new Set();
  // All emails so far.
  // False positives are not very possible.
  const knownEmails = new Set();

  // Process each of the forms.
  const forms = formUrls.map(form_url => FormApp.openByUrl(form_url));
  forms.forEach(form => processForm_(form, knownNames, knownEmails, origBlobs, convBlobs));

  // Make sure that we have removed each of the opt-outs at least once.
  const unproc = blocklist.getUnprocessedEmails();
  if (unproc.size !== 0) {
    throw new Error(`Unprocessed opt-out emails found: ${new Array(...unproc).join(', ')}`);
  }

  // Archive each of the blob sets, and save them to the output folder.
  if (origBlobs.length === 0) {
    throw new Error('No blobs found to archive.');
  }
  console.info('Archiving original files...'); // TODO count
  const origZipBlob = Utilities.zip(origBlobs, 'original_resumes.zip');
  outputFolder.createFile(origZipBlob);
  if (convBlobs.length !== 0) {
    console.info('Archiving converted files...');
    const convertedZipBlob = Utilities.zip(convBlobs, 'converted_resumes.zip');
    outputFolder.createFile(convertedZipBlob);
  }
}
