import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import "firebase/compat/database";
import { EnvironmentStorageService } from '../utils/environment-storage.service';

// Không export trực tiếp biến đã khởi tạo nữa vì cần chờ async config
// export const FirebaseDatabase = firebase.database();

let initializedApp: firebase.app.App = null;

export const getFirebaseDatabase = async () => {
  if (!initializedApp) {
    // Lấy config từ storage hoặc mặc định
    const config = await EnvironmentStorageService.getFirebaseConfig();

    // Kiểm tra xem đã có app nào tên mặc định chưa để tránh lỗi duplicate app
    if (firebase.apps.length === 0) {
      initializedApp = firebase.initializeApp(config);
    } else {
      // Nếu đã có rồi (do reload extension context) thì dùng lại, 
      // nhưng nếu config thay đổi thì cần logic phức tạp hơn (xóa app cũ). 
      // Ở đây giả định đơn giản là dùng app hiện tại hoặc tái khởi tạo nếu cần.
      // Với extension service worker, biến toàn cục có thể bị reset.

      // Để an toàn, ta delete app cũ và init lại với config mới nhất
      await firebase.app().delete().catch(() => { });
      initializedApp = firebase.initializeApp(config);
    }
  }
  return initializedApp.database();
};
