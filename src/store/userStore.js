// store/userStore.js
import {create} from 'zustand';

const useUserStore = create((set) => ({
  userInfo: JSON.parse(localStorage.getItem('userInfo')) || null,
  setUserInfo: (userInfo) => {
    localStorage.setItem('userInfo', JSON.stringify(userInfo));
    set({ userInfo });
  },
  clearUserInfo: () => {
    localStorage.removeItem('userInfo');
    set({ userInfo: null });
  },
}));

export default useUserStore;
