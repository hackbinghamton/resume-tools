# Resume Tools

One of the benefits we offer to sponsors of the [HackBU Hackathon event](https://hackbu.org/hackathons/) is access to a compilation of the attendees' resumes. We receive these resumes as file attachments of two to three different registration forms, in varying input formats. The number of resumes we that we take in motivates the automated solution that this repository comprises.

## Stage 1: ResumeExtractor

The first stage of processing is a script targetting [Google Apps Script](https://developers.google.com/apps-script) which does the following:

- Enumerates the responses to each of the configured forms.
- Filters out respondents who have opted out of sharing their resume.
- Applies arbitrary transformation to names, such as:
  - Trimming leading and trailing whitespace.
  - Specifying full names where the respondent only put their first name.
  - Correctly capitalizing names that have been recorded in all-lowercase.
    - Extra capitalization is kept, as this can be the product of cultural differences. For instance, French surnames are often recorded in all-uppercase. In any case, the human user should verify that this is consistent with what their resume does.
 - Collects the original resume file for each person.
 - Converts the resume files to PDF wherever necessary.
 - Produces an archive of the original resume set, and the converted resume step.

Once this stage is finished, we have:

- A ZIP archive of all of the original resume files (with Google Docs converted to `DOCX`).
- A ZIP archive of PDF conversions of all non-PDF resume files.

### Usage

- [Install clasp](https://github.com/google/clasp).
- Log into clasp using a Google Account which can access the form and resume data.
  - If you would like to associate the Apps Script with a Google Cloud Project, then you instead want to log into clasp using an account within the same domain as the GCP. It also seems that your account needs to be able to modify the GCP, so that clasp can set up permissions.
    - Wanting to use `clasp run` would be one reason to go this route, in which case the account you authorize through OAuth is the account that must be able to access the form in resume data. For the easiest time, consider using one Google Account which manages the GCP, has access to the Apps Script, and has access to the form and resume data.
- Make a copy of the configuraton:
  ```
  $ cp Config.template.js Config.js
  ```
- Fill out the template file.
- Create a new Apps Script project:
  ```
  $ clasp create --title "ResumeExtractor"
  ```
- Push the script from this repo, to Google:
  ```
  $ clasp push
  ```
- From the [Apps Script UI](https://script.google.com/), run the script.
  - The entrypoint is the `main` function in `Main.gs`.
  - Chances are, there will be some back and forth of fixing issues with the script.
- Download the two ZIPs from the configured output folder.

## Stage 2: resume-compiler

The goal of the second stage of processing is to sensibly combine all of the resumes. It is comprised of a shell script which does the following:

- Pools together all of the PDFs, converted or not.
- Fix any corrupted PDFs.
  - Once, someone uploaded a DOCX with a PDF extension, which this script can't cope with; replacement with a patching script is necessary.
- Using [Ghostscript](https://ghostscript.com/), detect and delete any blank pages.
- Using [pdftk](https://www.pdflabs.com/tools/pdftk-the-pdf-toolkit/), merge the PDFs into one.
- Using pdftk, generate a new table of contents that organizes the document by name.
- Using pdftk, prepend the provided cover page.

### Usage

- Save the two ZIP archives to the input directory `in`.
- Provide your own cover page for the resume book, as `in/cover_page.pdf`
- Run the script:
  ```
  $ ./resume-compiler.sh
  ```
  - To restrict each resume to one page, pass the `-1` argument.
