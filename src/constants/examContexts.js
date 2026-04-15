export const EXAM_CONTEXTS = [
  // SO VA PHEP TINH
  {
    id: 'sieu_thi',
    name: 'Siêu thị thông minh',
    description: 'Boi canh di mua sam, tinh tong chi phi, tinh % giam gia combo, so sanh gia giua cac cua hang, lua chon phuong an mua hop li voi ngan sach co dinh.',
    aiRole: 'Robot thu ngân',
    aiRoleDescription: 'Kiem tra cách tính tiền, phát hiện sai sót của học sinh khi mua hàng hóa.'
  },
  {
    id: 'tieu_vat',
    name: 'Quản lý tiền tiêu vặt',
    description: 'Tinh huong hoc sinh nhan tien tieu vat theo tuan/thang, tu lap ke hoach chi tieu, so sanh va lua chon phuong an su dung hop li, tiet kiem.',
    aiRole: 'Cố vấn tài chính',
    aiRoleDescription: 'Dieu chinh ke hoach chi tieu hop ly cho hoc sinh.'
  },
  {
    id: 'bep_an',
    name: 'Bếp ăn gia đình',
    description: 'Tinh huong doi song lien quan den bua an, chia khau phan an, tinh luong duong/chat beo/rau, so sanh voi muc khuyen nghi (5%, 10%), can doi dinh duong.',
    aiRole: 'Chuyên gia dinh dưỡng',
    aiRoleDescription: 'Nguoi dieu chinh che do dinh duong, khau phan an cho hop ly.'
  },
  {
    id: 'nha_truong',
    name: 'Nhà trường',
    description: 'Hoat dong thi dua, thong ke truong/lop. Tinh ti so thanh tich, luong rac thu gom, so cay trong, luong sach. So sanh danh gia ket qua giua cac nhom.',
    aiRole: 'EduAI',
    aiRoleDescription: 'Nguoi giam sat cac hoat dong o truong hoc.'
  },

  // HINH HOC VA DO LUONG
  {
    id: 'kien_truc_su',
    name: 'Kiến trúc sư',
    description: 'Tinh huong thiet ke khong gian song: tinh dien tich xay nha, lat gach, son tuong; tinh the tich phong, be nuoc, khoi da tha vao be. Toi uu phuong an.',
    aiRole: 'Kiến trúc sư tài ba',
    aiRoleDescription: 'Huong dan, danh gia ban thiet ke va ho tro tinh toan xay dung.'
  },
  {
    id: 'cuoc_dua',
    name: 'Cuộc đua kì thú',
    description: 'Co vu chang dua (xe dap, dua thuyen, chay bo). So sanh van toc, tinh thoi gian ve dich, tinh quang duong con lai. Yeu to chien thuat.',
    aiRole: 'Trọng tài AI / Hệ thống đo tốc độ',
    aiRoleDescription: 'Giam sat, theo doi so lieu va kiem tra ket qua cuoc dua.'
  },
  {
    id: 'du_lich',
    name: 'Hành trình du lịch',
    description: 'Lap ke hoach chuyen di (di hoc, tham quan, ve que). Chon phuong tien phu hop, tinh thoi gian di chuyen, so sanh 2 lo trinh toi uu.',
    aiRole: 'Hướng dẫn viên thông minh',
    aiRoleDescription: 'Tu van lo trinh, thoi gian va phuong tien di chuyen.'
  }
];

export const CHARACTER_GUIDE = `
TUYEN NHAN VAT CO DINH (BAT BUOC):
Moi bai toan su dung bo nhan vat hoc sinh: Mai, Viet, Nam.
- Co the su dung linh hoat 1, 2 hoac ca 3 nhan vat tuy muc dich cua de.
- Mai: Co the tham gia vao boi canh mua sam, nau an, nghe thuat.
- Việt: Nang dong, thich the thao, kham pha.
- Nam: Thong minh, thich tinh toan, lap ke hoach.
QUY TAC NGHIEM NGAT: Cac nhan vat chi moi la hoc sinh lop 5.
- KHONG THE tu lai xe may hay o to. Phuong tien di chuyen tu tuc chi co the la di bo hoac di xe dap.
- Trong boi canh "Cuoc dua", cac nhan vat KHONG tham gia lai xe dua, CHI LA nguoi di co vu, chung kien, ghi chep so lieu.
- Neu de bai co "thoi gian nghi" giua cac chang/vong thi dau: khi hoi doi nao ve dich nhanh hon thi PHAI tinh tong thoi gian BAO GOM ca thoi gian nghi.
- Chi dung cum "duoc tru X giay moi vong" khi muc tieu la bai toan co thuong/thoi gian uu dai va da neu ro quy tac tru thoi gian.
- Long ghep yeu to giao duc (an toan giao thong, tiet kiem, dinh duong).
`;
