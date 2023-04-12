const _ = require('lodash');
const config = require('../config');
const utils = require('../lib/utils');
const objectPath = require('object-path');
const transitionUtils = require('./utils');
const db = require('../db');
const NAME = 'update_contact';
const CONFIG_NAME = 'update_contact';
const MARK_PROPERTY_NAME = 'mark_contact_update_forms';
const SOURCE_FORM_FIELD_NAME = 'form_field_name';

const getConfig = () => config.get(CONFIG_NAME) || {};
const getConfirmFormCodes = () => getConfig()[MARK_PROPERTY_NAME] || [];
const getSourceFieldName = () => getConfig()[SOURCE_FORM_FIELD_NAME];
const isConfirmForm = form => getConfirmFormCodes().includes(form);


const getSourceFieldValue = report => {
  const config = getSourceFieldName();
  return (config && objectPath.get(report, config));
};

const updatePatient = (patient, doc) => {
  if (isConfirmForm(doc.form)) {
    const fieldName = getSourceFieldName();
    patient[fieldName.slice(fieldName.indexOf('.') + 1)] = getSourceFieldValue(doc);
  }
  return db.medic.put(patient);
};

module.exports = {
  filter: ({doc, info}) => {
    return Boolean(
      doc &&
        doc.form &&
        doc.type === 'data_record' &&
        isConfirmForm(doc.form) &&
        doc.patient &&
        !transitionUtils.hasRun(info, NAME) &&
        utils.isValidSubmission(doc)
    );
  },
  init: () => {
    const forms = getConfirmFormCodes();
    if (!forms || !_.isArray(forms) || !forms.length) {
      throw new Error(`Configuration error. Config must have a '${CONFIG_NAME}.${MARK_PROPERTY_NAME}' array defined.`);
    }
    if (!getSourceFieldName()) {
      throw new Error(
        `Configuration error. Config must have a '${CONFIG_NAME}.${SOURCE_FORM_FIELD_NAME}' form field defined.`
      );
    }
  },
  name: NAME,
  onMatch: change => {
    const hydratedPatient = change.doc.patient;
    if (!hydratedPatient._id) {
      return Promise.resolve(false);
    }

    return db.medic
      .get(hydratedPatient._id)
      .then(patient => updatePatient(patient, change.doc))
      .then(changed => !!changed);
  },
};
