const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const digits = value => String(value || '').replace(/\D/g, '');
export function isPhoneQuery(value) {
  const query = String(value || '').trim();
  return query.startsWith('+') || (/\d/.test(query) && /^[\d\s().-]+$/.test(query));
}
export function filterPhoneContacts(contacts, query) {
  const text = fold(query), number = digits(query);
  return contacts.flatMap(contact => (contact.phoneNumbers || []).map((phone, index) => ({
    id: `${contact.id}-${index}`, name: contact.name || phone.number, number: phone.number || '',
  }))).filter(contact => !text || fold(contact.name).includes(text) || fold(contact.number).includes(text) ||
    (isPhoneQuery(query) && !!number && digits(contact.number).includes(number)));
}
