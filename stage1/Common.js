class EntityNotFound extends Error {
  constructor(message) {
    super(message);
    this.name = "EntityNotFound";
  }
}

class Blocklist {
  constructor(emails) {
    this.emails = new Set(emails);
    this.processed_emails = new Set();
  }

  // Returns whether an email is blocked.
  process(email) {
    if (this.emails.has(email)) {
      this.processed_emails.add(email);
      return true;
    }
    return false;
  }

  differenceOfSets(x, y) {
    let difference = new Set(x);
    for (const e of y) {
      difference.delete(e);
    }
    return difference;
  }

  getUnprocessedEmails() {
    return this.differenceOfSets(this.emails, this.processed_emails);
  }
}