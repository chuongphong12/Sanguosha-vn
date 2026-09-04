import type { GeneralDefinition, Role, SkillDefinition } from "../model";

export const SKILLS: Record<string, SkillDefinition> = {
  "jian-xiong": {
    id: "jian-xiong",
    name: "Gian Hùng",
    chineseName: "奸雄",
    description:
      "Sau khi bị sát thương, có thể nhận các lá bài đã gây ra sát thương đó.",
  },
  "hu-jia": {
    id: "hu-jia",
    name: "Hộ Giá",
    chineseName: "护驾",
    description:
      "Chủ công kỹ: Khi cần dùng [Thiểm], có thể yêu cầu tướng Ngụy đánh thay.",
    lordSkill: true,
  },
  "fan-kui": {
    id: "fan-kui",
    name: "Phản Quỹ",
    chineseName: "反馈",
    description:
      "Sau khi bị sát thương, có thể rút ngẫu nhiên 1 lá bài của người gây sát thương.",
  },
  "gui-cai": {
    id: "gui-cai",
    name: "Quỷ Tài",
    chineseName: "鬼才",
    description:
      "Trước khi một lá bài Phán Xét có hiệu lực, có thể đánh ra 1 lá bài từ tay để thay thế.",
  },
  "gang-lie": {
    id: "gang-lie",
    name: "Cương Liệt",
    chineseName: "刚烈",
    description:
      "Sau khi bị sát thương, có thể bắt người gây sát thương phán xét: Nếu không phải Cơ, người đó phải bỏ 2 lá hoặc mất 1 máu.",
  },
  "tu-xi": {
    id: "tu-xi",
    name: "Đột Tập",
    chineseName: "突袭",
    description:
      "Giai đoạn rút bài, có thể bỏ rút bài để rút mỗi người 1 lá bài (tối đa 2 người khác nhau).",
  },
  "luo-yi": {
    id: "luo-yi",
    name: "Lõa Y",
    chineseName: "裸衣",
    description:
      "Giai đoạn rút bài, có thể rút ít hơn 1 lá. Nếu làm vậy, trong lượt sát thương của [Sát] và [Quyết Đấu] +1.",
  },
  "tian-du": {
    id: "tian-du",
    name: "Thiên Đố",
    chineseName: "天妒",
    description:
      "Sau khi phán xét của mình có hiệu lực, có thể nhận lá bài phán xét đó.",
  },
  "yi-ji": {
    id: "yi-ji",
    name: "Di Kế",
    chineseName: "遗计",
    description:
      "Sau khi mất 1 máu, được xem 2 lá bài và chia cho bất kỳ ai (kể cả bản thân).",
  },
  "luo-shen": {
    id: "luo-shen",
    name: "Lạc Thần",
    chineseName: "洛神",
    description:
      "Đầu lượt, có thể phán xét. Nếu là màu Đen thì nhận lá đó và có thể tiếp tục phán xét.",
  },
  "qing-guo": {
    id: "qing-guo",
    name: "Khuynh Quốc",
    chineseName: "倾国",
    description: "Có thể dùng lá bài màu Đen làm [Thiểm].",
  },
  "ren-de": {
    id: "ren-de",
    name: "Nhân Đức",
    chineseName: "仁德",
    description:
      "Giai đoạn ra bài, có thể đưa bài tùy ý cho người khác. Khi đưa từ 2 lá trở lên trong lượt, hồi 1 máu.",
  },
  "ji-jiang": {
    id: "ji-jiang",
    name: "Kích Tướng",
    chineseName: "激将",
    description:
      "Chủ công kỹ: Khi cần dùng [Sát], có thể yêu cầu tướng Thục đánh thay.",
    lordSkill: true,
  },
  "wu-sheng": {
    id: "wu-sheng",
    name: "Võ Thánh",
    chineseName: "武圣",
    description: "Có thể dùng lá bài màu Đỏ làm [Sát].",
  },
  "pao-xiao": {
    id: "pao-xiao",
    name: "Bào Hao",
    chineseName: "咆哮",
    description:
      "Trong giai đoạn ra bài, không bị giới hạn số lần sử dụng [Sát].",
  },
  "guan-xing": {
    id: "guan-xing",
    name: "Quan Tinh",
    chineseName: "观星",
    description:
      "Đầu lượt, được xem X lá bài trên cùng bộ bài (X là số người sống, tối đa 5), rồi tùy ý đặt lại trên đầu hoặc dưới cùng bộ bài.",
  },
  "kong-cheng": {
    id: "kong-cheng",
    name: "Không Thành",
    chineseName: "空城",
    description:
      "Khóa kỹ: Khi không có bài trên tay, không thể bị chọn làm mục tiêu của [Sát] hoặc [Quyết Đấu].",
    lockedSkill: true,
  },
  "long-dan": {
    id: "long-dan",
    name: "Long Đảm",
    chineseName: "龙胆",
    description: "Có thể dùng [Sát] làm [Thiểm] và ngược lại.",
  },
  "ma-shu": {
    id: "ma-shu",
    name: "Mã Thuật",
    chineseName: "马术",
    description: "Khóa kỹ: Khoảng cách tính đến người khác luôn bị trừ 1.",
    lockedSkill: true,
  },
  "tie-ji": {
    id: "tie-ji",
    name: "Thiết Kỵ",
    chineseName: "铁骑",
    description:
      "Khi dùng [Sát] lên một mục tiêu, có thể yêu cầu phán xét. Nếu là Đỏ, mục tiêu không thể dùng [Thiểm] để né.",
  },
  "ji-zhi": {
    id: "ji-zhi",
    name: "Tập Trí",
    chineseName: "集智",
    description:
      "Mỗi khi sử dụng thẻ Cẩm nang (trừ Diên thời), có thể rút 1 lá bài.",
  },
  "qi-cai": {
    id: "qi-cai",
    name: "Kỳ Tài",
    chineseName: "奇才",
    description: "Khóa kỹ: Sử dụng thẻ Cẩm nang không bị giới hạn về tầm đánh.",
    lockedSkill: true,
  },
  "zhi-heng": {
    id: "zhi-heng",
    name: "Chế Hành",
    chineseName: "制衡",
    description:
      "Giai đoạn ra bài, có thể bỏ X lá bài trên tay hoặc khu trang bị để rút X lá (chỉ 1 lần mỗi lượt).",
  },
  "jiu-yuan": {
    id: "jiu-yuan",
    name: "Cứu Viện",
    chineseName: "救援",
    description:
      "Chủ công kỹ, Khóa kỹ: Khi sắp chết, tướng Ngô dùng [Đào] cứu bạn sẽ giúp bạn hồi 2 máu.",
    lordSkill: true,
    lockedSkill: true,
  },
  "qi-xi": {
    id: "qi-xi",
    name: "Kỳ Tập",
    chineseName: "奇袭",
    description: "Có thể dùng lá bài màu Đen làm [Quá Hà Sách Kiều].",
  },
  "ke-ji": {
    id: "ke-ji",
    name: "Khắc Kỷ",
    chineseName: "克己",
    description:
      "Nếu không dùng [Sát] trong giai đoạn ra bài, không phải bỏ bài thừa cuối lượt.",
  },
  "ku-rou": {
    id: "ku-rou",
    name: "Khổ Nhục",
    chineseName: "苦肉",
    description: "Giai đoạn ra bài, có thể tự giảm 1 máu để rút 2 lá bài.",
  },
  "ying-zi": {
    id: "ying-zi",
    name: "Anh Tư",
    chineseName: "英姿",
    description: "Giai đoạn rút bài, được rút thêm 1 lá.",
  },
  "fan-jian": {
    id: "fan-jian",
    name: "Phản Gián",
    chineseName: "反间",
    description:
      "Giai đoạn ra bài, có thể chỉ định 1 người nói 1 chất bài, sau đó rút 1 lá của bạn. Nếu sai, mất 1 máu. Người đó nhận lá bài đó.",
  },
  "guo-se": {
    id: "guo-se",
    name: "Quốc Sắc",
    chineseName: "国色",
    description:
      "Có thể dùng lá bài màu Đỏ (Rô/Cơ) làm [Binh Lương Thốn Đoạn].",
  },
  "liu-li": {
    id: "liu-li",
    name: "Lưu Ly",
    chineseName: "流离",
    description:
      "Khi bị [Sát] nhắm tới, có thể bỏ 1 lá bài để chuyển mục tiêu [Sát] sang 1 người khác trong tầm đánh.",
  },
  "qian-xun": {
    id: "qian-xun",
    name: "Khiêm Tốn",
    chineseName: "谦逊",
    description:
      "Khóa kỹ: Không thể bị chọn làm mục tiêu của [Thuận Thủ Khiên Dương] và [Quá Hà Sách Kiều].",
    lockedSkill: true,
  },
  "lian-ying": {
    id: "lian-ying",
    name: "Liên Doanh",
    chineseName: "连营",
    description:
      "Mỗi khi mất lá bài cuối cùng trên tay, được rút lập tức 1 lá bài.",
  },
  "jie-yin": {
    id: "jie-yin",
    name: "Kết Nhân",
    chineseName: "结姻",
    description:
      "Giai đoạn ra bài, có thể bỏ 2 lá bài trên tay, chọn 1 nam tướng bị thương, cả hai cùng hồi 1 máu.",
  },
  "xiao-ji": {
    id: "xiao-ji",
    name: "Kiêu Cơ",
    chineseName: "枭姬",
    description: "Mỗi khi mất đi một trang bị, bạn được rút 2 lá bài.",
  },
  "ji-jiu": {
    id: "ji-jiu",
    name: "Cấp Cứu",
    chineseName: "急救",
    description:
      "Bên ngoài lượt của mình, có thể dùng lá bài màu Đỏ làm [Đào].",
  },
  "qing-nang": {
    id: "qing-nang",
    name: "Thanh Nang",
    chineseName: "青囊",
    description:
      "Giai đoạn ra bài, có thể bỏ 1 lá bài trên tay để hồi 1 máu cho một mục tiêu bất kỳ (chỉ 1 lần mỗi lượt).",
  },
  "wu-shuang": {
    id: "wu-shuang",
    name: "Vô Song",
    chineseName: "无双",
    description:
      "Khóa kỹ: Khi bạn dùng [Sát], mục tiêu phải dùng 2 [Thiểm] để né. Dùng [Quyết Đấu], mục tiêu phải ra 2 [Sát].",
    lockedSkill: true,
  },
  "li-jian": {
    id: "li-jian",
    name: "Ly Gián",
    chineseName: "离间",
    description:
      "Giai đoạn ra bài, có thể bỏ 1 lá bài, ép 2 nam tướng [Quyết Đấu] với nhau (chỉ 1 lần mỗi lượt).",
  },
  "bi-yue": {
    id: "bi-yue",
    name: "Bế Nguyệt",
    chineseName: "闭月",
    description: "Cuối lượt, có thể rút 1 lá bài.",
  },
  "yao-wu": {
    id: "yao-wu",
    name: "Diệu Võ",
    chineseName: "耀武",
    description:
      "Khóa kỹ: Khi bị sát thương bằng thẻ màu Đỏ, người gây sát thương được hồi 1 máu hoặc rút 1 lá.",
    lockedSkill: true,
  },
  "wang-zun": {
    id: "wang-zun",
    name: "Vọng Tôn",
    chineseName: "妄尊",
    description:
      "Giai đoạn chuẩn bị của Chủ công, bạn có thể rút 1 lá, và giới hạn bài trên tay của Chủ công giảm đi 1 trong lượt này.",
  },
  "tong-ji": {
    id: "tong-ji",
    name: "Đồng Tật",
    chineseName: "同疾",
    description:
      "Khóa kỹ: Nếu số bài trên tay của bạn lớn hơn máu hiện tại, những người khác không thể dùng [Sát] chỉ định mục tiêu nào ngoài bạn.",
    lockedSkill: true,
  },
};

export const GENERALS: GeneralDefinition[] = [
  {
    id: "cao-cao",
    name: "Tào Tháo",
    chineseName: "曹操",
    faction: "wei",
    gender: "male",
    maxHP: 4,
    skillIDs: ["jian-xiong", "hu-jia"],
  },
  {
    id: "sima-yi",
    name: "Tư Mã Ý",
    chineseName: "司马懿",
    faction: "wei",
    gender: "male",
    maxHP: 3,
    skillIDs: ["fan-kui", "gui-cai"],
  },
  {
    id: "xiahou-dun",
    name: "Hạ Hầu Đôn",
    chineseName: "夏侯惇",
    faction: "wei",
    gender: "male",
    maxHP: 4,
    skillIDs: ["gang-lie"],
  },
  {
    id: "zhang-liao",
    name: "Trương Liêu",
    chineseName: "张辽",
    faction: "wei",
    gender: "male",
    maxHP: 4,
    skillIDs: ["tu-xi"],
  },
  {
    id: "xu-chu",
    name: "Hứa Chử",
    chineseName: "许褚",
    faction: "wei",
    gender: "male",
    maxHP: 4,
    skillIDs: ["luo-yi"],
  },
  {
    id: "guo-jia",
    name: "Quách Gia",
    chineseName: "郭嘉",
    faction: "wei",
    gender: "male",
    maxHP: 3,
    skillIDs: ["tian-du", "yi-ji"],
  },
  {
    id: "zhen-ji",
    name: "Chân Cơ",
    chineseName: "甄姬",
    faction: "wei",
    gender: "female",
    maxHP: 3,
    skillIDs: ["luo-shen", "qing-guo"],
  },
  {
    id: "liu-bei",
    name: "Lưu Bị",
    chineseName: "刘备",
    faction: "shu",
    gender: "male",
    maxHP: 4,
    skillIDs: ["ren-de", "ji-jiang"],
  },
  {
    id: "guan-yu",
    name: "Quan Vũ",
    chineseName: "关羽",
    faction: "shu",
    gender: "male",
    maxHP: 4,
    skillIDs: ["wu-sheng"],
  },
  {
    id: "zhang-fei",
    name: "Trương Phi",
    chineseName: "张飞",
    faction: "shu",
    gender: "male",
    maxHP: 4,
    skillIDs: ["pao-xiao"],
  },
  {
    id: "zhuge-liang",
    name: "Gia Cát Lượng",
    chineseName: "诸葛亮",
    faction: "shu",
    gender: "male",
    maxHP: 3,
    skillIDs: ["guan-xing", "kong-cheng"],
  },
  {
    id: "zhao-yun",
    name: "Triệu Vân",
    chineseName: "赵云",
    faction: "shu",
    gender: "male",
    maxHP: 4,
    skillIDs: ["long-dan"],
  },
  {
    id: "ma-chao",
    name: "Mã Siêu",
    chineseName: "马超",
    faction: "shu",
    gender: "male",
    maxHP: 4,
    skillIDs: ["ma-shu", "tie-ji"],
  },
  {
    id: "huang-yueying",
    name: "Hoàng Nguyệt Anh",
    chineseName: "黄月英",
    faction: "shu",
    gender: "female",
    maxHP: 3,
    skillIDs: ["ji-zhi", "qi-cai"],
  },
  {
    id: "sun-quan",
    name: "Tôn Quyền",
    chineseName: "孙权",
    faction: "wu",
    gender: "male",
    maxHP: 4,
    skillIDs: ["zhi-heng", "jiu-yuan"],
  },
  {
    id: "gan-ning",
    name: "Cam Ninh",
    chineseName: "甘宁",
    faction: "wu",
    gender: "male",
    maxHP: 4,
    skillIDs: ["qi-xi"],
  },
  {
    id: "lu-meng",
    name: "Lữ Mông",
    chineseName: "吕蒙",
    faction: "wu",
    gender: "male",
    maxHP: 4,
    skillIDs: ["ke-ji"],
  },
  {
    id: "huang-gai",
    name: "Hoàng Cái",
    chineseName: "黄盖",
    faction: "wu",
    gender: "male",
    maxHP: 4,
    skillIDs: ["ku-rou"],
  },
  {
    id: "zhou-yu",
    name: "Chu Du",
    chineseName: "周瑜",
    faction: "wu",
    gender: "male",
    maxHP: 3,
    skillIDs: ["ying-zi", "fan-jian"],
  },
  {
    id: "da-qiao",
    name: "Đại Kiều",
    chineseName: "大乔",
    faction: "wu",
    gender: "female",
    maxHP: 3,
    skillIDs: ["guo-se", "liu-li"],
  },
  {
    id: "lu-xun",
    name: "Lục Tốn",
    chineseName: "陆逊",
    faction: "wu",
    gender: "male",
    maxHP: 3,
    skillIDs: ["qian-xun", "lian-ying"],
  },
  {
    id: "sun-shangxiang",
    name: "Tôn Thượng Hương",
    chineseName: "孙尚香",
    faction: "wu",
    gender: "female",
    maxHP: 3,
    skillIDs: ["jie-yin", "xiao-ji"],
  },
  {
    id: "hua-tuo",
    name: "Hoa Đà",
    chineseName: "华佗",
    faction: "qun",
    gender: "male",
    maxHP: 3,
    skillIDs: ["ji-jiu", "qing-nang"],
  },
  {
    id: "lu-bu",
    name: "Lữ Bố",
    chineseName: "吕布",
    faction: "qun",
    gender: "male",
    maxHP: 4,
    skillIDs: ["wu-shuang"],
  },
  {
    id: "diao-chan",
    name: "Điêu Thuyền",
    chineseName: "貂蝉",
    faction: "qun",
    gender: "female",
    maxHP: 3,
    skillIDs: ["li-jian", "bi-yue"],
  },
  {
    id: "hua-xiong",
    name: "Hoa Hùng",
    chineseName: "华雄",
    faction: "qun",
    gender: "male",
    maxHP: 6,
    skillIDs: ["yao-wu"],
  },
  {
    id: "yuan-shu",
    name: "Viên Thuật",
    chineseName: "袁术",
    faction: "qun",
    gender: "male",
    maxHP: 4,
    skillIDs: ["wang-zun", "tong-ji"],
  },
];

export const GENERALS_BY_ID = Object.fromEntries(
  GENERALS.map((general) => [general.id, general]),
);
export const LORD_GENERAL_IDS = ["cao-cao", "liu-bei", "sun-quan"] as const;

export function getActiveSkillIDs(generalID: string, role: Role): string[] {
  const general = GENERALS_BY_ID[generalID];
  if (!general) return [];
  return general.skillIDs.filter(
    (skillID) => role === "lord" || !SKILLS[skillID].lordSkill,
  );
}

export function hasLordSkill(generalID: string): boolean {
  return GENERALS_BY_ID[generalID]?.skillIDs.some(
    (skillID) => SKILLS[skillID].lordSkill,
  );
}
