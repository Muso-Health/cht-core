require('chai').should();
const sinon = require('sinon');
const db = require('../../../src/db');
const utils = require('../../../src/lib/utils');
const config = require('../../../src/config');

describe('update_contact', () => {
  let transition;
  const vaccination = 'completed';

  beforeEach(() => {
    config.init({
      getAll: sinon.stub().returns({}),
      get: sinon.stub(),
    });
    transition = require('../../../src/transitions/update_contact');
  });

  afterEach(done => {
    sinon.reset();
    sinon.restore();
    done();
  });

  describe('onMatch', () => {
    it('saves patient state', () => {
      const patientId = 'some-uuid';
      const patient = { _id: patientId, name: 'greg' };
      const change = {
        doc: {
          form: 'vaccination',
          fields: { patient_id: patientId, vaccination_state: vaccination },
          patient: patient, // lineage hydrates this patient property
        },
      };
      config.get.returns({
        mark_contact_update_forms: ['vaccination'],
        form_field_name: 'fields.vaccination_state'
      });

      const saveDoc = sinon.stub(db.medic, 'put').resolves({ ok: true });
      const get = sinon.stub(db.medic, 'get').withArgs(patient._id).resolves(patient);
      return transition.onMatch(change).then(changed => {
        changed.should.equal(true);
        get.callCount.should.equal(1);
        get.args[0].should.deep.equal([patientId]);
        saveDoc.callCount.should.equal(1);
        saveDoc.args[0].should.deep.equal([{
          _id: patientId,
          name: 'greg',
          vaccination_state: vaccination,
        }]);
      });
    });

    it('marks a patient state with shortcode', () => {
      const patientId = '00001';
      const patient = { name: 'greg', _id: 'greg_uuid', patient_id: patientId };
      const change = {
        doc: {
          form: 'vaccination',
          fields: { patient_id: patientId, vaccination_state: vaccination },
          patient: patient,
        },
      };
      config.get.returns({
        mark_contact_update_forms: ['vaccination'],
        form_field_name: 'fields.vaccination_state'
      });
      const saveDoc = sinon.stub(db.medic, 'put').resolves({ ok: true });
      sinon.stub(db.medic, 'get').withArgs(patient._id).resolves(patient);
      return transition.onMatch(change).then(changed => {
        changed.should.equal(true);
        db.medic.get.callCount.should.equal(1);
        db.medic.get.args[0].should.deep.equal([patient._id]);
        saveDoc.callCount.should.equal(1);
        saveDoc.args[0].should.deep.equal([{
          name: 'greg',
          _id: 'greg_uuid',
          patient_id: patientId,
          vaccination_state: vaccination,
        }]);
      });
    });

    it('does not require patient_id', () => {
      const patientId = '00001';
      const patient = { name: 'greg', _id: 'greg_uuid', patient_id: patientId };
      const change = {
        doc: {
          form: 'vaccination',
          fields: { patient_uuid: patient._id, vaccination_state: vaccination  },
          patient: patient,
        },
      };
      config.get.returns({
        mark_contact_update_forms: ['vaccination'],
        form_field_name: 'fields.vaccination_state'
      });
      const saveDoc = sinon.stub(db.medic, 'put').resolves({ ok: true });
      sinon.stub(db.medic, 'get').withArgs(patient._id).resolves(patient);
      return transition.onMatch(change).then(changed => {
        changed.should.equal(true);
        db.medic.get.callCount.should.equal(1);
        db.medic.get.args[0].should.deep.equal([patient._id]);
        saveDoc.callCount.should.equal(1);
        saveDoc.args[0].should.deep.equal([{
          name: 'greg',
          _id: 'greg_uuid',
          patient_id: patientId,
          vaccination_state: vaccination,
        }]);
      });
    });

    it('should do nothing if patient somehow is not hydrated or something', () => {
      const patientId = '00001';
      const change = {
        doc: {
          form: 'vaccination',
          fields: { patient_uuid: patientId, vaccination_state: vaccination },
          patient: { empty: '????' },
        },
      };
      config.get.returns({
        mark_contact_update_forms: ['vaccination'],
        form_field_name: 'fields.vaccination_state'
      });
      sinon.stub(db.medic, 'put');
      sinon.stub(db.medic, 'get');
      return transition.onMatch(change).then(changed => {
        changed.should.equal(false);
        db.medic.get.callCount.should.equal(0);
        db.medic.put.callCount.should.equal(0);
      });
    });
  });

  describe('filter', () => {
    it('empty doc returns false', () => {
      transition.filter({ doc: {} }).should.equal(false);
    });

    it('no type returns false', () => {
      config.get.returns({ mark_contact_update_forms: ['x', 'y'], form_field_name: 'fields.vaccination_state' });
      transition.filter({ doc: { form: 'x' } }).should.equal(false);
      transition.filter({ doc: { from: 'x' }}).should.equal(false);
    });

    it('no patient returns false', () => {
      config.get.returns({ mark_contact_update_forms: ['x', 'y'], form_field_name: 'fields.vaccination_state'  });
      transition.filter({ doc: { form: 'x', type: 'data_record' }}).should.equal(false);
    });

    it('invalid submission returns false', () => {
      config.get.returns({
        mark_contact_update_forms: ['vaccination'], form_field_name: 'fields.vaccination_state'
      });

      sinon.stub(utils, 'isValidSubmission').returns(false);
      transition
        .filter({
          doc: {
            type: 'data_record',
            form: 'vaccination',
            fields: {},
            patient: {}
          },
          info: {}
        })
        .should.equal(false);
      utils.isValidSubmission.callCount.should.equal(1);
      utils.isValidSubmission.args[0]
        .should.deep.equal([{ type: 'data_record', form: 'vaccination', fields: { }, patient: { } }]);
    });

    it('returns true', () => {
      config.get.returns({
        mark_contact_update_forms: ['vaccination', 'vaccination_followup'],
        form_field_name: 'fields.vaccination_state'
      });

      sinon.stub(utils, 'isValidSubmission').returns(true);
      transition
        .filter({
          doc: {
            type: 'data_record',
            form: 'vaccination',
            fields: { patient_id: '12', vaccination_state: vaccination },
            patient: { patient_id: '12' }
          },
          info: {}
        })
        .should.equal(true);
      transition
        .filter({
          doc: {
            type: 'data_record',
            form: 'vaccination_followup',
            fields: { patient_id: '12', vaccination_state: vaccination },
            patient: { patient_id: '12' }
          },
          info: {}
        })
        .should.equal(true);
      utils.isValidSubmission.callCount.should.equal(2);
      utils.isValidSubmission.args[0].should.deep.equal([
        {
          type: 'data_record',
          form: 'vaccination',
          fields: {
            patient_id: '12',
            vaccination_state: vaccination
          },
          patient: {
            patient_id: '12'
          }
        }
      ]);
      utils.isValidSubmission.args[1].should.deep.equal([
        {
          type: 'data_record',
          form: 'vaccination_followup',
          fields: {
            patient_id: '12',
            vaccination_state: vaccination
          },
          patient: {
            patient_id: '12'
          }
        }
      ]);
    });
  });
});
