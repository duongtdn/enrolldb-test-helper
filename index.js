"use strict"

const DatabaseAbstractor = require('database-abstractor');

const enrolldb = new DatabaseAbstractor();

const db = {
  host: null,
  port: null
}

const enroll01 = { 
  uid: 'tester@team.com', 
  courseId: 'emb-01', 
  detail: { status : 'active' }, 
  price: 500 
};

const enroll02 = { 
  uid: 'tester@team.com', 
  courseId: 'emb-02', 
  detail: { status : 'billing' }, 
  price: 500 
};

module.exports = {

  _dbready: false,

  _tables: null,

  _users: {},

  queue: [],

  use({host, port}) {
    db.host = host;
    db.port = port;

    enrolldb.use(require('enrolldb-dynamodb-driver')(
      {
        region : 'us-west-2', 
        endpoint : `${db.host}:${db.port}`
      },
      (err, data) => {
        if (err) {
          console.log('Failed to init local db')
          throw new Error(err)
        } else {
          this._dbready = true;
          this._tables = data.TableNames;
          if (this.queue.length > 0) {
            this.queue.forEach(fn => this[fn.name].apply(this,fn.args))
          }
        }
      }
    ))

    return this;
  },

  init(done) {
    if (!db.host && !db.port) {
      throw new Error('host and port of database must be define.')
    }
    if (this._tables) {
      if (this._tables.indexOf('ENROLL') === -1) {
        console.log('\nInitializing ENROLL Table...')
        return this.new(() => {
          console.log('ENROLL Table is created and ready to use.');
          done && done();
        });
      } else {
        console.log('ENROLL Table already exists')
        done && done();
        return this;
      }
    } else {
      this.queue.push({name: 'init', args: [done]})
    }
  },

  new(done) {
    if (!db.host && !db.port) {
      throw new Error('host and port of database must be define.')
    }
    if (this._dbready) {
      enrolldb.createTable((err, data) => {
        if (err) {
          console.log('Failed to create ENROLL table')
          console.log(err);
        } else {  
          this._createNewEntries(done);
        }
      })
    } else {
      this.queue.push({name: 'new', args: [done]})
    }
    return this;
  },

  reset () {
    if (!db.host && !db.port) {
      throw new Error('host and port of database must be define.')
    }
    const self = this;
    if (this._dbready) {
      enrolldb.dropTable(function(err, data) {
        if (err) {
          console.log('Failed to drop ENROLL table')
          console.log(err);
        } else {
          console.log('Dropped old ENROLL table')
          enrolldb.createTable((err, data) => {
            if (err) {
              console.log('Failed to create ENROLL table')
              console.log(err);
            } else {  
              self._createNewEntries();
            }
          })
        }
      })
    } else {
      this.queue.push({name: 'reset', args: [done]})
    }
    return this;
  },

  _createNewEntry(enroll) {
    return new Promise((resolve, reject) => {
      enrolldb.createEnroll(enroll, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data)
        }
      })
    })
  },

  _createNewEntries(done) {
    console.log('Creating new enrollments...')  
    Promise.all([
      this._createNewEntry(enroll01), 
      this._createNewEntry(enroll02),
    ]).then(values => {
      console.log('Created all enrollments.')
      done && done();
    }).catch(function(err) {
      console.log(err);
      done && done(err)
    });
    return this;
  }

}

