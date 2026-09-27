/** The same rule the server applies to new passwords. */
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,200}$/;
export const PASSWORD_HINT = 'At least 8 characters, with a capital letter, a small letter, a number and a symbol.';
