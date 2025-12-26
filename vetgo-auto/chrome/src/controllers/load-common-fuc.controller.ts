import { getFirebaseDatabase } from './common.firebase';
import { RealtimeDbCrud } from "./firebase-crud";
import { EnvironmentStorageService } from "../utils/environment-storage.service";

const COMMON_FUC = 'COMMON-FUNC';

export module CommonFunc {
  export const load = async (): Promise<any> => {
    const environmentName = await EnvironmentStorageService.getEnvironmentName();
    
    // Khởi tạo DB async
    const database = await getFirebaseDatabase();
    const db = new RealtimeDbCrud<any>(database);
    
    const list = await db.list(`ENV/${environmentName}/script`) as any[];
    const l = (list || []).filter((it: any) => it.domain === COMMON_FUC && it.actionType === 'MAIN');

    if (l.length !== 0) {
      return l[0].code;
    } else {
      return `console.log('empty...${COMMON_FUC}')`;
    }
  }
}
