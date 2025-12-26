import { environment } from "../../environments/environment";

const STORAGE_KEY = 'environmentName';
const FIREBASE_CONFIG_KEY = 'firebaseConfig';
const DEFAULT_ENVIRONMENT = environment.environmentName;

export class EnvironmentStorageService {
    /**
     * Lấy environment name từ chrome.storage
     */
    static async getEnvironmentName(): Promise<string> {
        return new Promise((resolve) => {
            chrome.storage.sync.get([STORAGE_KEY], (result) => {
                const envName = result[STORAGE_KEY] || DEFAULT_ENVIRONMENT;
                resolve(envName);
            });
        });
    }

    /**
     * Lưu environment name vào chrome.storage
     */
    static async setEnvironmentName(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!name || name.trim() === '') {
                reject(new Error('Environment name cannot be empty'));
                return;
            }

            chrome.storage.sync.set({ [STORAGE_KEY]: name.trim() }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Lấy cấu hình Firebase. Ưu tiên storage, fallback về environment mặc định
     */
    static async getFirebaseConfig(): Promise<any> {
        return new Promise((resolve) => {
            chrome.storage.sync.get([FIREBASE_CONFIG_KEY], (result) => {
                const customConfig = result[FIREBASE_CONFIG_KEY];
                if (customConfig && Object.keys(customConfig).length > 0) {
                    resolve(customConfig);
                } else {
                    resolve(environment.firebaseConfig);
                }
            });
        });
    }

    /**
     * Lưu cấu hình Firebase tùy chỉnh
     */
    static async setFirebaseConfig(config: any): Promise<void> {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.set({ [FIREBASE_CONFIG_KEY]: config }, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Reset về giá trị mặc định
     */
    static async resetToDefault(): Promise<void> {
        try {
            await this.setEnvironmentName(DEFAULT_ENVIRONMENT);
            // Xóa config firebase custom để dùng mặc định
            await new Promise<void>((resolve) => {
                chrome.storage.sync.remove(FIREBASE_CONFIG_KEY, () => resolve());
            });
        } catch (e) {
            throw e;
        }
    }
}
