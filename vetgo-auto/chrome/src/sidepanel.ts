import { EnvironmentStorageService } from './utils/environment-storage.service';
import { environment } from '../environments/environment';

// DOM Elements
const form = document.getElementById('configForm') as HTMLFormElement;
const environmentInput = document.getElementById('environmentName') as HTMLInputElement;
const firebaseConfigInput = document.getElementById('firebaseConfig') as HTMLTextAreaElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const messageDiv = document.getElementById('message') as HTMLDivElement;
const currentEnvSpan = document.getElementById('currentEnv') as HTMLSpanElement;

/**
 * Hiển thị thông báo cho người dùng
 */
function showMessage(text: string, type: 'success' | 'error') {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;

    // Tự động ẩn thông báo sau 3 giây
    setTimeout(() => {
        messageDiv.className = 'message';
    }, 3000);
}

/**
 * Load và hiển thị giá trị hiện tại
 */
async function loadCurrentConfig() {
    try {
        // Load Env Name
        const envName = await EnvironmentStorageService.getEnvironmentName();
        currentEnvSpan.textContent = envName;
        environmentInput.value = envName;

        // Load Firebase Config
        const fbConfig = await EnvironmentStorageService.getFirebaseConfig();
        
        // Kiểm tra xem có phải config mặc định không
        const isDefault = JSON.stringify(fbConfig) === JSON.stringify(environment.firebaseConfig);
        
        if (!isDefault) {
            firebaseConfigInput.value = JSON.stringify(fbConfig, null, 2);
        } else {
            firebaseConfigInput.value = ''; // Để trống nếu đang dùng default
            firebaseConfigInput.placeholder = `Đang sử dụng mặc định:\n${JSON.stringify(environment.firebaseConfig, null, 2)}`;
        }

    } catch (error) {
        console.error('Error loading config:', error);
        currentEnvSpan.textContent = 'Lỗi khi tải cấu hình';
        showMessage('Không thể tải cấu hình hiện tại', 'error');
    }
}

/**
 * Xử lý sự kiện submit form
 */
async function handleSubmit(event: Event) {
    event.preventDefault();

    const newEnvName = environmentInput.value.trim();
    const firebaseConfigStr = firebaseConfigInput.value.trim();

    if (!newEnvName) {
        showMessage('Vui lòng nhập tên môi trường', 'error');
        return;
    }

    try {
        // 1. Lưu Environment Name
        await EnvironmentStorageService.setEnvironmentName(newEnvName);
        currentEnvSpan.textContent = newEnvName;

        // 2. Lưu Firebase Config
        if (firebaseConfigStr) {
            try {
                const configObj = JSON.parse(firebaseConfigStr);
                // Validate sơ bộ
                if (!configObj.apiKey || !configObj.databaseURL) {
                    throw new Error("Config thiếu apiKey hoặc databaseURL");
                }
                await EnvironmentStorageService.setFirebaseConfig(configObj);
            } catch (e) {
                showMessage('❌ JSON Firebase Config không hợp lệ: ' + (e as Error).message, 'error');
                return;
            }
        } else {
            // Nếu để trống, xóa custom config để dùng default
             await new Promise<void>((resolve) => {
                chrome.storage.sync.remove('firebaseConfig', () => resolve());
            });
        }

        showMessage('✅ Lưu cấu hình thành công!', 'success');
        // Reload lại hiển thị để update placeholder/value
        loadCurrentConfig();
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showMessage('❌ Lỗi khi lưu cấu hình: ' + (error as Error).message, 'error');
    }
}

/**
 * Xử lý sự kiện reset về mặc định
 */
async function handleReset() {
    if (!confirm('Bạn có chắc muốn đặt lại tất cả về mặc định?')) {
        return;
    }

    try {
        await EnvironmentStorageService.resetToDefault();
        await loadCurrentConfig(); // Reload UI
        showMessage('✅ Đã đặt lại về cấu hình mặc định!', 'success');
    } catch (error) {
        console.error('Error resetting environment:', error);
        showMessage('❌ Lỗi khi đặt lại cấu hình', 'error');
    }
}

// Event Listeners
form.addEventListener('submit', handleSubmit);
resetBtn.addEventListener('click', handleReset);

// Load giá trị hiện tại khi trang được mở
loadCurrentConfig();
