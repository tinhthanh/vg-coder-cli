import * as cloneDeep from 'lodash/cloneDeep';
import { uuid } from "../utils/db-utils";
interface EntityModel {
  id?: string; // Optional for new entities
  seqNo: number;
  deleted: boolean;
}
export function firebaseSerialize<T>(object: T) {
  return cloneDeep(object);
}
export class RealtimeDbCrud<T extends EntityModel> {
  constructor(
    protected database: any
  ) {
    this.database = database;
  }
  getCurrentTimestamp() {
    return new Date().getTime();
  }

  addAll(list, collectionName: string) {
    const updates = {};
    for (let item of list) {
      if (!item.id) {
        item.id = uuid();
      }
      item = { ...item, seqNo: this.getCurrentTimestamp(), deleted: false };
      updates[`/${collectionName}/${item.id}`] = firebaseSerialize(item);
    }
    return this.database.ref().update(updates).then(() => list);
  }

  list(collectionName: string) {
    return new Promise((resolve, reject) => {
      this.database
        .ref(collectionName)
        .once('value')
        .then((snapshot) => {
          const data = snapshot.val();
          const list = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
          resolve(list);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }
  // work okie
  getRT(id: string,collectionName: string, callback: (item: T) => void ) {
    const databaseRef = this.database.ref(`${collectionName}/${id}`);
    databaseRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        callback(data);
      } else {
        callback(null);
      }
    });
  }
  // work okie
  get(id: string,collectionName: string) {
    return new Promise((resolve, reject) => {
      this.database
        .ref(`${collectionName}/${id}`)
        .once('value')
        .then((snapshot) => {
          const data = snapshot.val();
          if (data) {
            console.log(data);
            resolve({ id, ...data });
          } else {
            resolve(null);
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  add(entity, collectionName: string) {
    entity = { ...entity, seqNo: this.getCurrentTimestamp(), deleted: false };
    return new Promise((resolve, reject) => {
      if (entity.id) {
        const saveData = firebaseSerialize(entity);
        this.database
          .ref(`${collectionName}/${entity.id}`)
          .set(saveData)
          .then(() => {
            resolve(entity);
          })
          .catch((error) => {
            reject(error);
          });
      } else {
        const id = uuid();
        const newEntity = { id, ...entity };
        this.database
          .ref(collectionName)
          .push(firebaseSerialize(newEntity))
          .then(() => {
            resolve(newEntity);
          })
          .catch((error) => {
            reject(error);
          });
      }
    });
  }

  update(entity, collectionName: string) {
    return this.add(entity, collectionName );
  }

  listBySeq(maxSeqNo, collectionName: string) {
    return new Promise((resolve, reject) => {
      this.database
        .ref(collectionName)
        .orderByChild('seqNo')
        .startAt(maxSeqNo)
        .once('value')
        .then((snapshot) => {
          const data = snapshot.val();
          const list = Object.keys(data).map((key) => ({ id: key, ...data[key] }));
          resolve(list);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  delete(entity,collectionName: string) {
    entity = { ...entity, seqNo: this.getCurrentTimestamp(), deleted: true };
    return new Promise((resolve, reject) => {
      this.database
        .ref(`${collectionName}/${entity.id}`)
        .set(firebaseSerialize(entity))
        .then(() => {
          resolve(entity);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }
}
