function normalizeCreatePublicState(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.some((item) => normalizeCreatePublicState(item));
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['true', '1', 'yes', 'on', '公开'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'off', '私密'].includes(normalized)) {
      return false;
    }

    return normalized !== '';
  }

  return Boolean(value);
}

module.exports = {
  normalizeCreatePublicState
};
