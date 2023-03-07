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

//
// OVERVIEW
//
// This script does the following:
//  - Enumerates the responses to each of the configured forms.
//  - Filters out respondents who have opted out of sharing their resume.
//  - Applies arbitrary transformation to names, such as:
//    - Trimming leading and trailing whitespace.
//    - Specifying full names where the respondent only put their first name.
//    - Correctly capitalizing names that have been recorded in all-lowercase.
//      - Extra capitalization is kept, as this can be the product of cultural differences.
//        For instance, French surnames are often recorded in all-uppercase.
//        In any case, it should be consistent with what their resume does.
//  - Collects the original resume file for each person.
//  - Converts the resume files to PDF wherever necessary.
//  - Produces an archive of the original resume set, and the converted resume step.
//
// USAGE
//
//  - Setup a configuration from the template.
//  - Run the script (if broken, fix it and rerun).
//  - Download the two ZIPs.
//  - Extract each of the two ZIPs into their own folders.
//  - Fix any corrupted PDFs.
//    - Once, someone uploaded a DOCX with a PDF extension, which this script can't cope with.
//  - Create a third folder comprised of:
//    - Only the PDFs from the original files.
//    - All of the converted files.
//  - In the third folder, merge the PDFs: `pdftk *.pdf cat output ../resume_book.pdf verbose`
//  - Apply any further transformations such as:
//    - Filtering out empty pages (see separate script).
//    - Prepending a cover page(s).
//    - Clearing the table of contents.
//
// KNOWN ISSUES
//
//  - Conversion from DOCX, DOTX, and DOC to PDF will create a temporary file.
//    We do immediately trash it, but you should probably be aware of this.
//  - We redo the conversions every run. This script could be optimized by saving them in a folder.
//  - The archive is pretty big; at scale, I would be worried about runnning into the 6-minute time-out.
//

// don't forget to empty your trash
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
  console.info('Archiving original files...');
  const origZipBlob = Utilities.zip(origBlobs, 'original_resumes.zip');
  outputFolder.createFile(origZipBlob);
  if (convBlobs.length !== 0) {
    console.info('Archiving converted files...');
    const convertedZipBlob = Utilities.zip(convBlobs, 'converted_resumes.zip');
    outputFolder.createFile(convertedZipBlob);
  }
}
