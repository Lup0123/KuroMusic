import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export const TAG_CATEGORIES = ['genre', 'mood', 'scene', 'language', 'activity', 'style']

export const TAG_LEXICON = [
  // ---- genre 曲风 ----
  { id: 'genre-rock', label: '摇滚', category: 'genre', aliases: ['rock', '摇滚乐', '硬摇', '英伦摇滚'] },
  { id: 'genre-pop', label: '流行', category: 'genre', aliases: ['pop', '流行乐', '华语流行'] },
  { id: 'genre-folk', label: '民谣', category: 'genre', aliases: ['folk', '独立民谣', '城市民谣'] },
  { id: 'genre-electronic', label: '电子', category: 'genre', aliases: ['electronic', '电音', '电子乐'] },
  { id: 'genre-rap', label: '说唱', category: 'genre', aliases: ['rap', 'hiphop', 'hip-hop', '嘻哈', '饶舌'] },
  { id: 'genre-rnb', label: 'R&B', category: 'genre', aliases: ['节奏布鲁斯', 'rnb', 'soul rnb'] },
  { id: 'genre-jazz', label: '爵士', category: 'genre', aliases: ['jazz', '爵士乐'] },
  { id: 'genre-classical', label: '古典', category: 'genre', aliases: ['classical', '古典乐', '交响'] },
  { id: 'genre-punk', label: '朋克', category: 'genre', aliases: ['punk', '朋克摇滚'] },
  { id: 'genre-metal', label: '金属', category: 'genre', aliases: ['metal', '重金属', '摇滚金属'] },
  { id: 'genre-blues', label: '蓝调', category: 'genre', aliases: ['blues', '布鲁斯'] },
  { id: 'genre-reggae', label: '雷鬼', category: 'genre', aliases: ['reggae'] },
  { id: 'genre-funk', label: '放克', category: 'genre', aliases: ['funk'] },
  { id: 'genre-soul', label: '灵魂乐', category: 'genre', aliases: ['soul'] },
  { id: 'genre-country', label: '乡村', category: 'genre', aliases: ['country', '乡村音乐'] },
  { id: 'genre-indie', label: '独立', category: 'genre', aliases: ['indie', '独立音乐', '独立摇滚'] },
  { id: 'genre-alternative', label: '另类', category: 'genre', aliases: ['alternative', '另类摇滚'] },
  { id: 'genre-postrock', label: '后摇', category: 'genre', aliases: ['post-rock', 'postrock'] },
  { id: 'genre-psychedelic', label: '迷幻', category: 'genre', aliases: ['psychedelic', '迷幻摇滚'] },
  { id: 'genre-experimental', label: '实验', category: 'genre', aliases: ['experimental', '实验音乐'] },
  { id: 'genre-dance', label: '舞曲', category: 'genre', aliases: ['dance', '跳舞音乐'] },
  { id: 'genre-house', label: '浩室', category: 'genre', aliases: ['house', 'house音乐'] },
  { id: 'genre-techno', label: '科技舞曲', category: 'genre', aliases: ['techno'] },
  { id: 'genre-dnb', label: '鼓打贝斯', category: 'genre', aliases: ['drum and bass', 'dnb', 'drum&bass'] },
  { id: 'genre-ambient', label: '氛围', category: 'genre', aliases: ['ambient', '氛围音乐'] },
  { id: 'genre-world', label: '世界音乐', category: 'genre', aliases: ['world', 'world music'] },
  { id: 'genre-latin', label: '拉丁', category: 'genre', aliases: ['latin', '拉丁音乐'] },
  { id: 'genre-bossa', label: '波萨诺瓦', category: 'genre', aliases: ['bossa nova', '巴萨诺瓦'] },
  { id: 'genre-flamenco', label: '弗拉门戈', category: 'genre', aliases: ['flamenco'] },
  { id: 'genre-chinese-folk', label: '国乐', category: 'genre', aliases: ['民乐', '民族音乐', '国风音乐'] },
  { id: 'genre-guofeng', label: '古风', category: 'genre', aliases: ['国风', '古风音乐'] },
  { id: 'genre-vaporwave', label: '蒸汽波', category: 'genre', aliases: ['vaporwave', '蒸气波'] },
  { id: 'genre-citypop', label: '城市流行', category: 'genre', aliases: ['city pop', 'citypop'] },
  { id: 'genre-synthpop', label: '合成器流行', category: 'genre', aliases: ['synthpop', 'synth pop'] },
  { id: 'genre-newwave', label: '新浪潮', category: 'genre', aliases: ['new wave'] },
  { id: 'genre-disco', label: '迪斯科', category: 'genre', aliases: ['disco'] },
  { id: 'genre-acapella', label: '阿卡贝拉', category: 'genre', aliases: ['a cappella', 'acapella', '人声合唱'] },
  { id: 'genre-instrumental', label: '纯音乐', category: 'genre', aliases: ['instrumental', '无歌词', '器乐'] },
  { id: 'genre-lofi', label: '低保真', category: 'genre', aliases: ['lofi', 'lo-fi', 'chill beats'] },
  { id: 'genre-kpop', label: '韩流', category: 'genre', aliases: ['kpop', 'k-pop'] },
  { id: 'genre-jpop', label: '日系流行', category: 'genre', aliases: ['jpop', 'j-pop', '日语流行'] },
  { id: 'genre-cantopop', label: '粤语流行', category: 'genre', aliases: ['cantopop', '粤语歌'] },
  { id: 'genre-piano', label: '钢琴曲', category: 'genre', aliases: ['piano', '钢琴'] },
  { id: 'genre-violin', label: '小提琴', category: 'genre', aliases: ['violin', '弦乐'] },
  { id: 'genre-sax', label: '萨克斯', category: 'genre', aliases: ['saxophone', 'sax'] },
  { id: 'genre-guzheng', label: '古筝', category: 'genre', aliases: ['古筝曲'] },
  { id: 'genre-erhu', label: '二胡', category: 'genre', aliases: ['二胡曲'] },
  { id: 'genre-flute', label: '笛子', category: 'genre', aliases: ['竹笛', '笛曲'] },
  { id: 'genre-oc', label: '动漫', category: 'genre', aliases: ['acg', 'anime', '二次元'] },
  { id: 'genre-game', label: '游戏原声', category: 'genre', aliases: ['game ost', '游戏音乐', 'bgm'] },
  { id: 'genre-film', label: '影视原声', category: 'genre', aliases: ['ost', '电影配乐', '影视音乐'] },
  { id: 'genre-chorus', label: '合唱', category: 'genre', aliases: ['chorus', '大合唱'] },
  { id: 'genre-gospel', label: '福音', category: 'genre', aliases: ['gospel'] },

  // ---- mood 心情 ----
  { id: 'mood-chill', label: '轻松', category: 'mood', aliases: ['chill', 'relax', '放松', '舒缓'] },
  { id: 'mood-happy', label: '快乐', category: 'mood', aliases: ['happy', '开心', '高兴', '欢快'] },
  { id: 'mood-sad', label: '伤感', category: 'mood', aliases: ['sad', '难过', 'emo', '伤心', '忧郁'] },
  { id: 'mood-heal', label: '治愈', category: 'mood', aliases: ['heal', '治愈系', '温暖', 'calm'] },
  { id: 'mood-focus', label: '专注', category: 'mood', aliases: ['focus', '集中', '心流', 'deep work'] },
  { id: 'mood-energetic', label: '动感', category: 'mood', aliases: ['energy', '燃', '激情', 'high'] },
  { id: 'mood-quiet', label: '安静', category: 'mood', aliases: ['quiet', '宁静', '安静放松'] },
  { id: 'mood-romantic', label: '浪漫', category: 'mood', aliases: ['romantic', '甜蜜', '心动'] },
  { id: 'mood-miss', label: '思念', category: 'mood', aliases: ['想念', '想一个人', '想你'] },
  { id: 'mood-lonely', label: '孤独', category: 'mood', aliases: ['lonely', '一个人', '深夜孤独'] },
  { id: 'mood-inspire', label: '振奋', category: 'mood', aliases: ['inspiring', '励志', '鼓舞', '加油'] },
  { id: 'mood-lazy', label: '慵懒', category: 'mood', aliases: ['lazy', '懒散', '午后慵懒'] },
  { id: 'mood-night', label: '深夜', category: 'mood', aliases: ['night', '夜晚', '深夜听'] },
  { id: 'mood-depressed', label: '丧', category: 'mood', aliases: ['emo', '颓废', '低气压'] },
  { id: 'mood-peace', label: '平静', category: 'mood', aliases: ['peace', '平和', '安稳'] },
  { id: 'mood-excited', label: '兴奋', category: 'mood', aliases: ['excited', '亢奋', '激动'] },
  { id: 'mood-sweet', label: '甜蜜', category: 'mood', aliases: ['sweet', '甜甜的', '恋爱'] },
  { id: 'mood-melancholy', label: '忧郁', category: 'mood', aliases: ['melancholy', 'blue', '低落'] },
  { id: 'mood-hope', label: '希望', category: 'mood', aliases: ['hope', '期待', '未来'] },
  { id: 'mood-powerful', label: '力量', category: 'mood', aliases: ['powerful', '有力量', '坚定'] },
  { id: 'mood-gentle', label: '温柔', category: 'mood', aliases: ['gentle', '温柔治愈', '轻声'] },
  { id: 'mood-cool', label: '酷', category: 'mood', aliases: ['cool', '耍酷', '帅气'] },
  { id: 'mood-nostalgic', label: '怀旧', category: 'mood', aliases: ['nostalgic', '复古', '回忆', '老歌'] },
  { id: 'mood-fresh', label: '清新', category: 'mood', aliases: ['fresh', '清爽', '小清新'] },
  { id: 'mood-hazy', label: '迷离', category: 'mood', aliases: ['hazy', '朦胧', '迷幻感'] },
  { id: 'mood-rising', label: '澎湃', category: 'mood', aliases: ['激昂', '热血', '汹涌'] },

  // ---- scene 场景 ----
  { id: 'scene-commute', label: '通勤', category: 'scene', aliases: ['commute', '地铁', '公交', '上班路上'] },
  { id: 'scene-study', label: '学习', category: 'scene', aliases: ['study', '自习', '写作业', '复习'] },
  { id: 'scene-work', label: '工作', category: 'scene', aliases: ['work', '办公', '上班', '写代码'] },
  { id: 'scene-run', label: '跑步', category: 'scene', aliases: ['run', '夜跑', '晨跑', '慢跑'] },
  { id: 'scene-gym', label: '健身', category: 'scene', aliases: ['gym', '运动', '撸铁', 'workout'] },
  { id: 'scene-drive', label: '开车', category: 'scene', aliases: ['driving', '驾车', '公路', '自驾'] },
  { id: 'scene-travel', label: '旅行', category: 'scene', aliases: ['travel', '旅途', 'road trip', '路上'] },
  { id: 'scene-cafe', label: '咖啡厅', category: 'scene', aliases: ['cafe', '咖啡', '下午茶', '书店'] },
  { id: 'scene-reading', label: '阅读', category: 'scene', aliases: ['reading', '看书', '读书'] },
  { id: 'scene-sleep', label: '睡前', category: 'scene', aliases: ['sleep', '助眠', '摇篮曲', '入睡'] },
  { id: 'scene-meditate', label: '冥想', category: 'scene', aliases: ['meditation', '打坐', '瑜伽'] },
  { id: 'scene-party', label: '派对', category: 'scene', aliases: ['party', '聚会', '开趴', '蹦迪'] },
  { id: 'scene-walk', label: '散步', category: 'scene', aliases: ['walk', '遛弯', '闲逛'] },
  { id: 'scene-rain', label: '雨天', category: 'scene', aliases: ['rain', '下雨', '淋雨', '听雨'] },
  { id: 'scene-sunny', label: '晴天', category: 'scene', aliases: ['sunny', '阳光', '大晴天'] },
  { id: 'scene-morning', label: '清晨', category: 'scene', aliases: ['morning', '早起', '起床'] },
  { id: 'scene-dusk', label: '黄昏', category: 'scene', aliases: ['dusk', '傍晚', '日落', '夕阳'] },
  { id: 'scene-overtime', label: '加班', category: 'scene', aliases: ['overtime', '熬夜', '深夜工作'] },
  { id: 'scene-coding', label: '写代码', category: 'scene', aliases: ['coding', '编程', '程序猿', 'debug'] },
  { id: 'scene-gaming', label: '打游戏', category: 'scene', aliases: ['gaming', '游戏', '电竞'] },
  { id: 'scene-cooking', label: '做饭', category: 'scene', aliases: ['cooking', '厨房', '做菜'] },
  { id: 'scene-date', label: '约会', category: 'scene', aliases: ['date', '约会氛围', '二人世界'] },
  { id: 'scene-wedding', label: '婚礼', category: 'scene', aliases: ['wedding', '婚礼现场', '仪式'] },
  { id: 'scene-nightdrive', label: '夜路', category: 'scene', aliases: ['夜间开车', '夜车', '城市夜景'] },

  // ---- language 语种 ----
  { id: 'lang-chinese', label: '华语', category: 'language', aliases: ['中文', '国语', '华语歌', 'mandarin'] },
  { id: 'lang-cantonese', label: '粤语', category: 'language', aliases: ['cantonese', '粤语歌'] },
  { id: 'lang-english', label: '欧美', category: 'language', aliases: ['英文', '英语', '欧美流行', 'english'] },
  { id: 'lang-japanese', label: '日语', category: 'language', aliases: ['日文', '日本', 'japanese'] },
  { id: 'lang-korean', label: '韩语', category: 'language', aliases: ['韩文', '韩国', 'korean'] },
  { id: 'lang-french', label: '法语', category: 'language', aliases: ['french', '法文'] },
  { id: 'lang-german', label: '德语', category: 'language', aliases: ['german', '德文'] },
  { id: 'lang-spanish', label: '西班牙语', category: 'language', aliases: ['spanish', '西语'] },
  { id: 'lang-italian', label: '意大利语', category: 'language', aliases: ['italian', '意语'] },
  { id: 'lang-thai', label: '泰语', category: 'language', aliases: ['thai', '泰文'] },
  { id: 'lang-russian', label: '俄语', category: 'language', aliases: ['russian', '俄文'] },
  { id: 'lang-instrumental', label: '纯音乐', category: 'language', aliases: ['无歌词', '轻音乐', 'instrumental'] },

  // ---- activity 活动 ----
  { id: 'act-sports', label: '运动', category: 'activity', aliases: ['锻炼', 'sports', '流汗'] },
  { id: 'act-study', label: '自习', category: 'activity', aliases: ['学习打卡', '图书馆', '自习室'] },
  { id: 'act-draw', label: '画画', category: 'activity', aliases: ['绘画', '涂鸦', '创作'] },
  { id: 'act-write', label: '写作', category: 'activity', aliases: ['写稿', '码字', '文案'] },
  { id: 'act-photo', label: '拍照', category: 'activity', aliases: ['摄影', '街拍'] },
  { id: 'act-nightlife', label: '夜生活', category: 'activity', aliases: ['夜店', '酒吧', '小酌'] },
  { id: 'act-shopping', label: '逛街', category: 'activity', aliases: ['购物', 'shopping', '商场'] },
  { id: 'act-cleaning', label: '打扫', category: 'activity', aliases: ['家务', '整理房间', '收纳'] },
  { id: 'act-bath', label: '泡澡', category: 'activity', aliases: ['沐浴', '放松泡澡'] },

  // ---- style 风格 ----
  { id: 'style-future', label: '未来感', category: 'style', aliases: ['科幻', '赛博朋克', 'future'] },
  { id: 'style-street', label: '街头', category: 'style', aliases: ['街头风', 'urban', 'swag'] },
  { id: 'style-underground', label: '地下', category: 'style', aliases: ['underground', '小众'] },
  { id: 'style-ethereal', label: '空灵', category: 'style', aliases: ['空灵感', '缥缈', '仙气'] },
  { id: 'style-gloomy', label: '阴郁', category: 'style', aliases: ['gloomy', '暗黑', '致郁'] },
  { id: 'style-slow', label: '慢节奏', category: 'style', aliases: ['抒情慢歌', '舒缓节奏'] },
  { id: 'style-fast', label: '快节奏', category: 'style', aliases: ['upbeat', '节奏快', '加速'] },
  { id: 'style-female', label: '女声', category: 'style', aliases: ['女歌手', '女声演绎'] },
  { id: 'style-male', label: '男声', category: 'style', aliases: ['男歌手', '男声演绎'] },
  { id: 'style-vocal', label: '高音', category: 'style', aliases: ['飙高音', '海豚音'] },
  { id: 'style-bass', label: '低音', category: 'style', aliases: ['重低音', '低音炮'] },
  { id: 'style-guitar', label: '吉他', category: 'style', aliases: ['木吉他', '电吉他', 'acoustic'] },
  { id: 'style-drum', label: '鼓点', category: 'style', aliases: ['架子鼓', '节奏鼓点'] },
  { id: 'style-synth', label: '合成器', category: 'style', aliases: ['synth', '电子合成器'] },
  { id: 'style-sampling', label: '采样', category: 'style', aliases: ['sample', 'remix', '混音'] },
  { id: 'style-duet', label: '对唱', category: 'style', aliases: ['男女对唱', '合唱对唱'] },
  { id: 'style-ballad', label: '情歌', category: 'style', aliases: ['ballad', '抒情歌', '爱情歌'] },
  { id: 'style-anthem', label: '热血', category: 'style', aliases: ['燃向', '中二', '动漫燃'] },
  { id: 'style-ethereal-v', label: '梦幻', category: 'style', aliases: ['dreamy', '童话', '仙境'] },
  { id: 'style-minimal', label: '极简', category: 'style', aliases: ['minimal', '简约'] },

  // ---- genre 补充 ----
  { id: 'genre-synthwave', label: '合成器浪潮', category: 'genre', aliases: ['synthwave', 'retrowave', '复古电子'] },
  { id: 'genre-hyperpop', label: '超流行', category: 'genre', aliases: ['hyperpop'] },
  { id: 'genre-chillhop', label: '弛放嘻哈', category: 'genre', aliases: ['chillhop', 'chill-hop', '学习嘻哈'] },
  { id: 'genre-darksynth', label: '暗黑合成器', category: 'genre', aliases: ['darksynth'] },
  { id: 'genre-shoegaze', label: '自赏', category: 'genre', aliases: ['shoegaze', '盯鞋'] },
  { id: 'genre-britpop', label: '英伦摇滚', category: 'genre', aliases: ['britpop', '英式摇滚'] },
  { id: 'genre-grunge', label: '垃圾摇滚', category: 'genre', aliases: ['grunge'] },
  { id: 'genre-dubstep', label: '回响贝斯', category: 'genre', aliases: ['dubstep'] },
  { id: 'genre-trap', label: '陷阱说唱', category: 'genre', aliases: ['trap'] },
  { id: 'genre-trance', label: '迷幻舞曲', category: 'genre', aliases: ['trance'] },
  { id: 'genre-dreampop', label: '梦幻流行', category: 'genre', aliases: ['dream pop', 'dream-pop'] },
  { id: 'genre-swing', label: '摇摆乐', category: 'genre', aliases: ['swing', '摇摆爵士'] },
  { id: 'genre-bigband', label: '大乐队', category: 'genre', aliases: ['big band'] },
  { id: 'genre-opera', label: '歌剧', category: 'genre', aliases: ['opera', '美声'] },
  { id: 'genre-musical', label: '音乐剧', category: 'genre', aliases: ['musical', '舞台剧'] },

  // ---- mood 补充 ----
  { id: 'mood-anxious', label: '焦虑', category: 'mood', aliases: ['anxious', '烦躁', '压力大'] },
  { id: 'mood-release', label: '释怀', category: 'mood', aliases: ['放空', '释然', '放下'] },
  { id: 'mood-stubborn', label: '倔强', category: 'mood', aliases: ['stubborn', '不服输', '倔脾气'] },
  { id: 'mood-heady', label: '上头', category: 'mood', aliases: ['洗脑', '停不下来', '越听越上瘾'] },
  { id: 'mood-warm', label: '温暖', category: 'mood', aliases: ['warm', '暖洋洋', '贴心'] },
  { id: 'mood-safe', label: '安心', category: 'mood', aliases: ['踏实', '安全感', '放心'] },
  { id: 'mood-free', label: '自在', category: 'mood', aliases: ['无拘无束', '自由', '随心'] },
  { id: 'mood-blank', label: '放空', category: 'mood', aliases: ['发呆', '放空大脑', '走神'] },
  { id: 'mood-calm', label: '心平气和', category: 'mood', aliases: ['calm', '平和', '气定神闲'] },
  { id: 'mood-bittersweet', label: '酸甜', category: 'mood', aliases: ['bittersweet', '又甜又苦'] },
  { id: 'mood-tender', label: '柔软', category: 'mood', aliases: ['细腻', '柔美', '轻声细语'] },
  { id: 'mood-bold', label: '大胆', category: 'mood', aliases: ['bold', '前卫', '突破'] },
  { id: 'mood-playful', label: '俏皮', category: 'mood', aliases: ['playful', '调皮', '古灵精怪'] },
  { id: 'mood-mysterious', label: '神秘', category: 'mood', aliases: ['mysterious', '悬疑', '未知'] },

  // ---- scene 补充 ----
  { id: 'scene-rush', label: '早晚高峰', category: 'scene', aliases: ['rush hour', '挤地铁', '高峰期'] },
  { id: 'scene-library', label: '图书馆', category: 'scene', aliases: ['library', '自习室'] },
  { id: 'scene-pool', label: '泳池', category: 'scene', aliases: ['swimming', '游泳', '戏水'] },
  { id: 'scene-beach', label: '海滩', category: 'scene', aliases: ['beach', '海边', '沙滩'] },
  { id: 'scene-mountain', label: '山间', category: 'scene', aliases: ['mountain', '爬山', '山野', '徒步'] },
  { id: 'scene-camp', label: '露营', category: 'scene', aliases: ['camping', '帐篷', '野营'] },
  { id: 'scene-bbq', label: '烧烤', category: 'scene', aliases: ['bbq', '撸串', '夜宵'] },
  { id: 'scene-balcony', label: '阳台', category: 'scene', aliases: ['窗边', '阳台吹风', '发呆看风景'] },
  { id: 'scene-snow', label: '雪天', category: 'scene', aliases: ['snow', '下雪', '冬日'] },
  { id: 'scene-stars', label: '星空', category: 'scene', aliases: ['starry', '看星星', '夜空'] },
  { id: 'scene-breakfast', label: '早餐', category: 'scene', aliases: ['morning coffee', 'brunch', '早点'] },
  { id: 'scene-dinner', label: '晚餐', category: 'scene', aliases: ['dinner', '烛光晚餐', '二人晚餐'] },
  { id: 'scene-garden', label: '花园', category: 'scene', aliases: ['garden', '公园', '花丛'] },
  { id: 'scene-ride', label: '骑行', category: 'scene', aliases: ['cycling', '骑车', 'bike'] },

  // ---- activity 补充 ----
  { id: 'act-walkdog', label: '遛狗', category: 'activity', aliases: ['walking dog', '遛宠物'] },
  { id: 'act-puzzle', label: '拼图', category: 'activity', aliases: ['puzzle', '桌游', '积木'] },
  { id: 'act-handmade', label: '手工', category: 'activity', aliases: ['handmade', 'diy', '做手工'] },
  { id: 'act-gardening', label: '园艺', category: 'activity', aliases: ['gardening', '养花', '植物'] },
  { id: 'act-stretch', label: '拉伸', category: 'activity', aliases: ['stretching', '放松操'] },
  { id: 'act-skate', label: '滑板', category: 'activity', aliases: ['skateboard', '轮滑', '滑冰'] },
  { id: 'act-trip', label: '出差', category: 'activity', aliases: ['business trip', '飞机', '机场', '高铁'] },
  { id: 'act-hiking', label: '徒步', category: 'activity', aliases: ['hiking', '远足', '爬山'] },

  // ---- style 补充 ----
  { id: 'style-trendy', label: '潮流', category: 'style', aliases: ['trendy', '时尚', '新潮'] },
  { id: 'style-retro', label: '复古', category: 'style', aliases: ['retro', '年代感', '老唱片'] },
  { id: 'style-noisy', label: '喧嚣', category: 'style', aliases: ['noisy', '炸裂', '吵闹'] },
  { id: 'style-soft', label: '柔和', category: 'style', aliases: ['soft', '柔光', '轻软'] },
  { id: 'style-strong', label: '强劲', category: 'style', aliases: ['powerful', '炸场', '有劲'] },
  { id: 'style-tragic', label: '悲情', category: 'style', aliases: ['tragic', '催泪', '虐心'] }
]

const LEXICON_CACHE_VERSION = 'v1'

function getUserDataDir() {
  try {
    if (typeof app?.getPath === 'function') return app.getPath('userData')
  } catch {
    // ignore
  }
  return process.cwd()
}

export function getLexiconCachePath() {
  const override = process.env.AI_LEXICON_CACHE_PATH
  if (override) return override
  const dir = join(getUserDataDir(), 'ai')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'lexicon-vectors.json')
}

export function computeLexiconVersion() {
  let hash = 5381
  for (const item of TAG_LEXICON) {
    const text = `${item.id}|${item.label}|${item.category}|${(item.aliases || []).join(' ')}`
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) + hash) + text.charCodeAt(index)
    }
  }
  return `${LEXICON_CACHE_VERSION}-${String(hash >>> 0)}`
}

export function cosineSimilarity(vectorA, vectorB) {
  if (!vectorA || !vectorB || vectorA.length !== vectorB.length) return 0
  let dot = 0
  let magnitudeA = 0
  let magnitudeB = 0
  for (let index = 0; index < vectorA.length; index += 1) {
    dot += vectorA[index] * vectorB[index]
    magnitudeA += vectorA[index] * vectorA[index]
    magnitudeB += vectorB[index] * vectorB[index]
  }
  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB)
  return magnitude === 0 ? 0 : dot / magnitude
}

function buildLexiconText(item) {
  return [item.label, ...(item.aliases || [])].filter(Boolean).join(' ')
}

function readCachedVectors() {
  try {
    if (!existsSync(getLexiconCachePath())) return null
    const payload = JSON.parse(readFileSync(getLexiconCachePath(), 'utf-8'))
    if (
      payload?.version !== computeLexiconVersion() ||
      !Array.isArray(payload.vectors) ||
      payload.vectors.length !== TAG_LEXICON.length
    ) {
      return null
    }
    return payload.vectors.map((vector) => Float32Array.from(vector || []))
  } catch {
    return null
  }
}

function writeCachedVectors(vectors) {
  try {
    writeFileSync(
      getLexiconCachePath(),
      JSON.stringify({
        version: computeLexiconVersion(),
        dimension: vectors[0]?.length || 0,
        vectors: vectors.map((vector) => Array.from(vector))
      }),
      'utf-8'
    )
    return true
  } catch {
    return false
  }
}

let cachedLexiconVectors = null

/** Test helper: clear in-memory lexicon vector cache. */
export function resetLexiconVectorsCache() {
  cachedLexiconVectors = null
}

/**
 * Ensure lexicon vectors are computed (embedding once, cached to disk).
 * Returns the vectors aligned with TAG_LEXICON, or null when embedding is unavailable.
 */
export async function ensureLexiconVectors(embed) {
  if (cachedLexiconVectors) return cachedLexiconVectors

  const cached = readCachedVectors()
  if (cached) {
    cachedLexiconVectors = cached
    return cached
  }

  if (typeof embed !== 'function') return null
  const vectors = await embed(TAG_LEXICON.map((item) => buildLexiconText(item)))
  if (!Array.isArray(vectors) || vectors.length !== TAG_LEXICON.length) return null

  cachedLexiconVectors = vectors
  writeCachedVectors(vectors)
  return vectors
}

/**
 * kNN: return top-N lexicon tags most similar to queryVector.
 */
export async function findNearestTags(queryVector, topN = 3, embed) {
  const vectors = await ensureLexiconVectors(embed)
  if (!vectors) return []

  const scored = TAG_LEXICON.map((item, index) => ({
    ...item,
    score: cosineSimilarity(queryVector, vectors[index])
  }))
    .filter((item) => item.score > 0.2)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, Math.max(1, Number(topN) || 3))
}

/** Prewarm lexicon vectors once the model is available. */
export function prewarm(embed) {
  if (typeof embed !== 'function') return Promise.resolve(null)
  return ensureLexiconVectors(embed).catch(() => null)
}
