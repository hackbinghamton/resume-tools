// Insert tmp folder ID here (for file conversions)
const tmpFolder = DriveApp.getFolderById('');

// Insert org folder ID here (suggested).
const hackbuYear = DriveApp.getFolderById('');
// Insert path from org folder ID to output folder.
const outputFolder = getFolderByPath_(hackbuYear, ['']);

// Insert opt-outs here.
const blocklist = new Blocklist([]);

// Insert form links here.
const formUrls = [];

function nameFixup_(name, email) {
  name = name.trim();

  // Apply transformations to names here.

  if (!name.includes(' ')) {
    console.warn(`Name ${name} has no space; might need fixup.`);
  }
  if (name == name.toLowerCase()) {
    console.warn(`Name ${name} is all lower case; might need fixup.`);
  }

  return name;
}
