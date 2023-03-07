// Retrieves a subfolder by name.
function getFolderByName_(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
  if (!folders.hasNext()) { 
    throw new EntityNotFound(`Folder "${parentFolder.getName()}/${name}"" not found.`);
  }
  const folder = folders.next();
  if (folders.hasNext()) {
    throw new Error(`More than one folder "${parentFolder.getName()}/${name}" found.`);
  }
  return folder;
}

// Retrieves a folder by starting from the parent folder, and
// descending into each component of the path array.
function getFolderByPath_(parentFolder, path) {
  let childFolder = parentFolder;
  for (const component of path) {
    childFolder = getFolderByName_(childFolder, component);
  }
  return childFolder;
}
