import { getFirebaseDatabase } from './common.firebase';
import { RealtimeDbCrud } from "./firebase-crud";
import { EnvironmentStorageService } from "../utils/environment-storage.service";
import { CLIPBOARD_HELPER_SCRIPT } from "../helpers/clipboard-helper";

const COMMON_FUC = 'COMMON-FUNC';

export module CommonFunc {
  export const load = async (): Promise<any> => {
    const environmentName = await EnvironmentStorageService.getEnvironmentName();
    
    // Khởi tạo DB async
    const database = await getFirebaseDatabase();
    const db = new RealtimeDbCrud<any>(database);
    
    const list = await db.list(`ENV/${environmentName}/script`) as any[];
    const l = (list || []).filter((it: any) => it.domain === COMMON_FUC && it.actionType === 'MAIN');

    let firebaseCode = '';
    if (l.length !== 0) {
      firebaseCode = l[0].code;
    } else {
      firebaseCode = `console.log('empty...${COMMON_FUC}')`;
    }
    
    // Always prepend clipboard helper to common functions
    return CLIPBOARD_HELPER_SCRIPT + '\n' + firebaseCode;
  }
}
