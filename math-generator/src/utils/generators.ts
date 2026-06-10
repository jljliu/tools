// Math generators utility for all 25 types of sheets

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Print formatter for CNY money addition/subtraction
function formatCNY(num: number): string {
  const ret: string[] = [];
  const yuan = Math.floor(num / 10);
  if (yuan > 0) {
    ret.push(`${yuan} 元`);
  }
  const jiao = Math.floor(num % 10);
  if (jiao > 0) {
    ret.push(`${jiao} 角`);
  }
  return ret.length > 0 ? ret.join(' ') : '0 元';
}

// Print formatter for CNY money comparison
function formatCNYCompare(num: number): string {
  const standard = Math.random() > 0.5;
  const ret: string[] = [];
  let temp = num;

  if (standard) {
    const yuan = Math.floor(temp / 100);
    if (yuan > 0) {
      ret.push(`${yuan} 元`);
    }
    temp = temp % 100;
  }
  const jiao = Math.floor(temp / 10);
  if (jiao > 0) {
    ret.push(`${jiao} 角`);
  }
  const fen = temp % 10;
  if (fen > 0) {
    ret.push(`${fen} 分`);
  }
  return ret.length > 0 ? ret.join(' ') : '0 角';
}

// Helpers for mixed complex operations
function getOp() {
  const r = Math.random();
  if (r < 0.25) return '+';
  if (r < 0.5) return '-';
  if (r < 0.75) return 'x';
  return '÷';
}

function findAllDivisors(target: number): number[] {
  const ret: number[] = [];
  for (let i = 1; i <= 10; i++) {
    if (target % i === 0) {
      ret.push(i);
    }
  }
  return ret;
}

function genTwoOpTarget(target: number, mustParam?: boolean): string {
  const r = Math.random();
  const addParam = !!mustParam || Math.random() < 0.5;

  if (r < 0.25 && target < 10) {
    const num1 = getRandomNumber(1, 10);
    const num3 = num1 * target;
    return `${addParam ? '(' : ''}${num3} ÷ ${num1}${addParam ? ')' : ''}`;
  } else if (r < 0.5) {
    const divisors = findAllDivisors(target);
    const num1 = divisors[Math.floor(Math.random() * divisors.length)] || 1;
    const num2 = target / num1;
    return `${addParam ? '(' : ''}${num1} x ${num2}${addParam ? ')' : ''}`;
  } else if (r < 0.75) {
    const num1 = getRandomNumber(0, target);
    const num2 = getRandomNumber(0, target - num1);
    return `(${num1} + ${num2})`;
  } else {
    const num1 = getRandomNumber(target, 99);
    const num2 = num1 - target;
    return `(${num1} - ${num2})`;
  }
}

function genTwoOpAny(): [string, number] {
  const r = Math.random();
  if (r < 0.25) {
    const num1 = getRandomNumber(1, 98);
    const num2 = getRandomNumber(1, 99 - num1);
    return [`${num1} + ${num2}`, num1 + num2];
  } else if (r < 0.5) {
    const num1 = getRandomNumber(2, 99);
    const num2 = getRandomNumber(1, num1 - 1);
    return [`${num1} - ${num2}`, num1 - num2];
  } else if (r < 0.75) {
    const num1 = getRandomNumber(1, 10);
    const num2 = getRandomNumber(1, 10);
    const num3 = num1 * num2;
    return [`${num3} ÷ ${num1}`, num2];
  } else {
    const num1 = getRandomNumber(1, 10);
    const num2 = getRandomNumber(1, 10);
    return [`${num1} x ${num2}`, num1 * num2];
  }
}

function genComplex1(): string {
  const op = getOp();
  if (op === 'x' || op === '÷') {
    const c = getRandomNumber(1, 9);
    let sum = 0;
    if (op === 'x') {
      sum = getRandomNumber(1, 9);
    } else {
      sum = c * getRandomNumber(1, 9);
    }
    return `${genTwoOpTarget(sum)} ${op} ${c} =`;
  } else {
    const [str, sum] = genTwoOpAny();
    let c = 0;
    if (op === '+') {
      c = getRandomNumber(1, 100 - sum);
    } else {
      c = getRandomNumber(0, sum);
    }
    const addParam = Math.random() < 0.5;
    return `${addParam ? '(' : ''}${str}${addParam ? ')' : ''} ${op} ${c} =`;
  }
}

function genComplex2(): string {
  const op = getOp();
  if (op === 'x' || op === '÷') {
    let c = 0;
    let sum = 0;
    if (op === 'x') {
      c = getRandomNumber(1, 9);
      sum = getRandomNumber(1, 9);
    } else {
      sum = getRandomNumber(1, 9);
      const ret = getRandomNumber(1, 9);
      c = sum * ret;
    }
    return `${c} ${op} ${genTwoOpTarget(sum, true)}  =`;
  } else {
    const [str, sum] = genTwoOpAny();
    let c = 0;
    if (op === '+') {
      c = getRandomNumber(1, 100 - sum);
    } else {
      c = getRandomNumber(sum, 100);
    }
    return `${c} ${op} (${str}) =`;
  }
}

// Chinese story/word problems from print.js
const wordProblems = [
  "男生有22人、女生有21人。一共有多少人？",
  "小红有 28个气球，小芳有24个气球，一共多少个？",
  "小军和小丽做灯笼，小军做了21个，小丽做了18个，一共多少个？",
  "小红看故事书，第一天看了42 页，第二天看了34页，两天一共看了多少页？",
  "爸爸掰了 77个玉米，我掰了6个，我们一共掰了多少个玉米？",
  "会议室里，单人椅有30把，双人椅有8把，一共几把椅子？",
  "食堂运来 2车大米，每车30袋，共多少袋？",
  "一条船上坐44人，另一条船坐55人，一共坐了多少人？",
  "有2箱水，每箱有35瓶，一共有多少瓶？",
  "小明做了8朵花，小虎做了20朵，一共做了多少朵？",
  "蛋糕店卖两种蛋糕，草莓蛋糕卖出了14个，柠檬蛋糕卖出了74个。两种蛋糕一共卖了多少个？",
  "学校举行文艺演出，表演唱歌的有45人，表演舞蹈的有18人。表演唱歌跳舞的一共有多少人？",
  "一个书包46元，一支钢笔27元。小明买了一个书包和一支钢笔，他一共花了多少钱？",
  "井冈山小学原来有男教师25名，女教师36名，学校一共有多少名老师？",
  "张老师买篮球用了42元，买排球用了39元，他一共用了多少元？",
  "学校体育室有 16 个足球，又买来26个，现在一共有多少个足球？",
  "奶奶养了46只白兔，5只黑兔。奶奶总共养了多少只兔子？",
  "商场卖了7把黑伞，又卖了38把黄伞。商场共卖了多少把伞？",
  "公交车里有41人，又上来13人，现在公交车上有多少人？",
  "原来有22人看戏，又来了13人，现在看戏的有多少人？",
  "小明买一支钢笔花了8元，买了一个书包80元，小明一共花了多少钱？",
  "礼品店的工作人员用彩带包扎礼盒，先用完6米红色彩带，又用完36 米蓝色彩带，一共用了多少米彩带？",
  "足球队有女运动员4人，男运动员11人。足球队共有多少人？",
  "王老师买跳绳用了 40元，买皮球用了 46元，一共花了多少钱？",
  "小红第一天做27 朵红花，第二天做了39朵，一共做了多少朵？",
  "大象一个月吃了36 个香蕉，猴子一个月吃了41个香蕉，他们一共吃了多少香蕉？",
  "小明和小红写字，小明写了53个，小红写了 41个，两人一共写了多少个？",
  "丫丫买了一本书50元，他弟弟买了一本书40元，他们一共花了多少钱？",
  "丁丁买了一辆玩具汽车花去 40元，买了一个篮球花去 29元。购买这两样玩具一共花了多少元？",
  "从花上飞走了 36只蝴蝶，又飞走了25只，两次飞走了多少只？",
  "学校原有 25瓶胶水，又买了19瓶，现在有多少瓶？",
  "小朋友做剪纸，用了 24张红纸，又用了同样多的黄纸，他们一共用了多少张纸？",
  "马场上有 39匹马，又来了52匹，现在马场上有多少匹马？",
  "一条马路两旁各种上48 棵树，一共种树多少棵？",
  "面包房做了54个面包，卖了22个，还剩多少个？",
  "两个小组共收集了94个水瓶、第一个小组收集了34个，第二組收集了多少个？",
  "故事书有74页，小丽第一天看了20 页，还剩多少页没有看？",
  "羊圈里原来有58只羊，走了6只，现在还有多少只？",
  "小明种了97 个萝卜，送给邻居15个，还剩多少个？",
  "有40人要过河，先过去了30人，还剩多少人？",
  "我有50元，要买一件 29元的衣服，还剩多少元？",
  "小红要折 80只纸鹤，她已经折了 51只，还要折多少只？",
  "2个人做了43个风车，小明做了20个，另外一个人做了多少个？",
  "50 棵白菜装两个筐，一个筐装了30棵，另一个筐要装多少？",
  "鱼塘里有39条鱼，小猫钓上8条，现在鱼塘里还有几条鱼？",
  "一个班级24个同学要喝水，但杯子只有9个。还需要几个杯子？",
  "树上有18只小鸟，飞走7只后，还剩下几只？",
  "爷爷送给小雨一盒巧克力，一共45块，小雨吃掉39块，还剩几块？",
  "妈妈有90元，买了一只小河马。小河马30元。妈妈还剩多少元？",
  "小白兔拔了48个萝卜，吃了4个，还剩几个萝卜？",
  "同学们去公园划船，一共 58人，第一条船坐了30人，还有多少人没坐上船？",
  "25 人用一条船过河，第一次坐13人，第二次要坐多少人？",
  "一本故事书78页，小红看40页，还要看多少页？",
  "小东和小明一共有20元，小东有4元，小明有多少钱？",
  "妈妈买了1盒彩笔，共19支，用去了15支，还剩多少支？",
  "操场上有72人要排两行，一行排41个人，另一行需要排多少人？",
  "有84张画，一间教室挂了41张，还有多少张没挂？",
  "同学们要做 57个灯笼，已做好18个，还要做多少个？",
  "飞机场上有75架飞机，飞走了63架，现在机场上有飞机多少架？",
  "小强家有 36 个苹果，吃了9个，还有多少个？",
  "汽车总站有 33辆汽车，开走了13辆，还有几辆？",
  "商店有25把扇子，卖出去16把，现在有多少把？",
  "学校有兰花和菊花共 65盆，兰花有 26盆，菊花有几盆？",
  "小青两次画了46 个桃子，第一次画了9个，第二次画了多少个？",
  "小红家有苹果和梨子共33个，苹果有14个，梨子有多少个？",
  "学校要把 42箱文具送给山区小学，已送去 27 箱，还要送几箱？",
  "家里有11棵白菜，吃了5棵，还有几棵？",
  "老师拿来篮球 and 足球共27个，篮球有9个。足球有多少个？",
  "小小要做80朵大红花，已经做了35朵，还有多少朵没有做？",
  "池塘里共有青蛙和癞蛤蟆49只，其中癞蛤蟆有20只。青蛙有多少只？",
  "蔬菜大棚里原有82根丝瓜，小华采摘后，还剩70根。小华摘走了多少根？",
  "书架上有36 本书，拿走一些，书架上还有9本书，拿走了多少本？",
  "学校有兰花和菊花太阳花共25 盆，其中兰花有6 盆，菊花有几盆？",
  "小东上午做了 38 道数学题，下午比上午多做了3道，小东下午做了多少道？",
  "小明今年8岁，爸爸今年 35岁。爸爸比小明大几岁？",
  "小东今年 18岁，妈妈今年46 岁。妈妈比小东大几岁？",
  "小明和爸爸一起去动物园玩，爸爸买票70元，小明买票20元，爸爸比小明多花多少元？",
  "小明、小强参加比赛，小明得分92分，小强得分87分，小明比小强多得多少分？",
  "两个球队比赛，一号队共进81分，二号队得分91分，一号比二号少多少分？",
  "小明今年8岁，爸爸的年龄比小明多 24岁，爸爸是多少岁？",
  "小刚存了43元，小兵存的比小刚少3元，小兵存了多少钱？",
  "家里有34个西红柿，家里的土豆比西红柿少20个。家里有多少个土豆？",
  "妈妈用80元买了双鞋，70元买了个包，鞋比包贵多少元？",
  "妈妈买了1个茶杯用去 24元，爸爸买了1个碗用去36元。碗比茶杯贵多少？",
  "有40只小兔，小猴的比小兔多 13只，小猴有多少只？",
  "小明和小红写字，小明写了83个，小红写了74个，谁写得多？多几个?",
  "小李有 43张邮票，小生的邮票比小李多9张，小生有邮票多少张？",
  "班里举行跳绳比赛，小红跳了53 下，小青比小红多跳8下，小青跳了多少下？",
  "蔷薇苑有13 栋楼，比玉兰苑少 40 栋。玉兰苑有多少栋楼？",
  "小华的班里有17名男生，比女生少9人。女生有多少人？",
  "小明集了76张卡片，小红比小明少集9张。小红集了多少张卡片？",
  "每个小朋友都有20 颗乳牙，一般每个成人有32颗恒牙。小朋友比成人少几颗牙齿？",
  "阳阳有83 本故事书，亮亮有30 本故事书。亮亮的故事书比阳阳的少多少本？",
  "学校举行文艺演出，参加唱歌表演的有45人，比参加舞蹈表演的多30人。参加舞蹈表演的有多少人？",
  "一件裤子46元，一件上衣比一条裤子多24元，一件上衣多少元？",
  "男生有35人，男生比女生多2人，女生有多少人？",
  "男生有35人，男生比女生少2人，女生有多少人？",
  "动物园有20只黑熊，黑熊比白熊多8只，白熊有多少只？",
  "动物园有20只黑熊，白熊比黑熊多8只，白熊有多少只？",
  "养鸡场有公鸡 44只，母鸡比公鸡多16只。母鸡有多少只？",
  "养鸡场有母鸡 60只，公鸡比母鸡少14只，公鸡有多少只？",
  "养鸡场有公鸡44只，公鸡比母鸡少16只。母鸡有多少只？",
  "小华有95 枚邮票，小明有83枚邮票，小明的邮票比小华多多少枚？",
  "小芳8岁，妈妈32岁，妈妈比小芳大几岁？",
  "教育大楼高38米，文化大楼比教育大楼高13米。文化大楼高多少米？",
  "妈妈今年34岁，乐乐比妈妈小25岁，乐乐今年多少岁？",
  "从车场开走 18辆汽车，还剩24辆，车场原来有多少汽车？",
  "树上有一群小鸟，飞走18只后，还剩下7只。树上原有小鸟多少只？",
  "丽丽家买一袋大米能吃 42天。上次爸爸买米后，已经吃了8天，剩下的大米还可以吃几天？",
  "一根彩带长65米，剪去一段后，还剩30米。剪去的那段长多少米？",
  "妈妈蒸了一笼包子一共12个，爸爸吃了 5个，小胖吃了2个，还剩下多少个包子？",
  "学校买来 50个皮球，参加拍球比赛的同学每人发一个皮球，结果还有16 个同学没有领到皮球。参加拍球比赛 the 同学一共有多少人？",
  "动物园的猴山里有17只公猴，母猴比公猴多3只。猴山上共有多少只猴子？",
  "实验小学举行运动会，参加排球的运动员有36人，参加跳绳的运动员比参加排球的多28人，参加这两项运动的一共有多少人？",
  "汽车站有60辆汽车，第一次开走28辆，第二次开走23辆，两次一共开走多少辆汽车？还剩多少辆汽车？",
  "服务部上午卖出汽水38瓶，下午卖出比上午多14瓶，一天共卖出多少瓶？",
  "王老师买了36 本练习本，买的算术本比练习本少8本，王老师一共买米多少本练习本和算术本？",
  "商店里有苹果25筐，梨比苹果多16 筐，苹果和梨一共有多少筐？",
  "小华收集邮票 59枚，小东收集邮票11 枚，小丽收集邮票22枚，三个人一共收集了多少枚邮票？",
  "妈妈带了80元去商店为我买学习用品：书本花了 48元，一只钢笔13元，文具盒27元，妈妈带的钱够吗？",
  "一本书一共有100页，第一天看了29页，第二天看了33页，两天一共看了多少页？还剩多少也没看？",
  "有梨33个，苹果比梨少9个，苹果和梨一共有多少个？",
  "婷婷的妈妈给她买了8本故事书。（1）科技书比故事书多3本。买了多少本科技书？（2）连环画比故事书少2本。连环画多少本？",
  "同学们今天上午种了25 棵树，下午种了19棵树，yesterday种了28棵树。（1）昨天比今天少种多少棵？（2）昨天和今天一共种了多少棵？",
  "果园里有 27 棵苹果树，梨树比苹果树多17棵，梨树有多少棵？一共有多少棵果树？",
  "合唱队有34名男生，女生比男生少8名。合唱队一共有多少名学生？",
  "小明看一本故事书，第一天看了30页，第二天比第一天少看5页，两天一共看了多少页？",
  "公交车上原来有36人，到站后下去17人，又上来12人，现在车上有多少人？",
  "水果店进了80 箱苹果，第一天卖出 22箱，第二天卖出28箱，还剩多少箱？",
  "仓库里有95台电视机，上午运走56 台，下午运来 30台，现仓库里有多少台电视机？",
  "一捆电线长90 米，一班用去20米，二班用去38米，一共用去多少米？",
  "一根绳子长 100米，第一次剪去49米，第二次剪去35米，这根绳子短了多少米？",
  "一根80米长的绳子，第一次用去34米，第二次用去25米，还剩下多少米？"
];

export interface GeneratorConfig {
  numberOfQuestions: number;
  pageCount: number;
  columns: number;
  fontSize: number;
  rowSpacing: number;
}

export interface GeneratorItem {
  id: string;
  name: string;
  description: string;
  category: string;
  defaultConfig: GeneratorConfig;
  generateQuestions: (count: number) => string[];
}

export const GENERATORS: GeneratorItem[] = [
  {
    id: 'add_within_5',
    name: 'Addition Within 5',
    description: 'Basic addition equations with sums up to 5.',
    category: 'Addition',
    defaultConfig: { numberOfQuestions: 51, pageCount: 10, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const num1 = getRandomNumber(1, 4);
        const num2 = getRandomNumber(1, 5 - num1);
        const item = `${num1} + ${num2} = `;
        if (q.length > 0 && q.slice(-6).includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'add_within_10',
    name: 'Addition Within 10',
    description: 'Addition equations with sums between 6 and 10.',
    category: 'Addition',
    defaultConfig: { numberOfQuestions: 51, pageCount: 10, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const num1 = getRandomNumber(1, 9);
        const num2 = getRandomNumber(Math.max(1, 6 - num1), 10 - num1);
        const item = `${num1} + ${num2} = `;
        if (q.length > 0 && q.slice(-6).includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'add_within_20',
    name: 'Addition Within 20',
    description: 'Addition equations with both operands >= 2 and sum <= 19.',
    category: 'Addition',
    defaultConfig: { numberOfQuestions: 51, pageCount: 10, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const num1 = getRandomNumber(2, 17);
        const num2 = getRandomNumber(2, 19 - num1);
        const item = `${num1} + ${num2} = `;
        if (q.includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'add_within_20_simple',
    name: 'Addition Within 20 (Simple)',
    description: 'Simple addition equations with sums up to 19.',
    category: 'Addition',
    defaultConfig: { numberOfQuestions: 51, pageCount: 10, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const num1 = getRandomNumber(1, 18);
        const num2 = getRandomNumber(1, 19 - num1);
        const item = `${num1} + ${num2} = `;
        if (q.includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'add_within_20_teen',
    name: 'Addition Within 20 (Teen)',
    description: 'Addition equations with one teen operand (10-19) and sum <= 20.',
    category: 'Addition',
    defaultConfig: { numberOfQuestions: 51, pageCount: 10, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        let num1 = getRandomNumber(10, 19);
        let num2 = getRandomNumber(0, 19 - num1);
        if (Math.random() < 0.5) {
          const temp = num1;
          num1 = num2;
          num2 = temp;
        }
        const item = `${num1} + ${num2} = `;
        if (q.includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'add_carry_to_teen',
    name: 'Addition with Carry (to Teen)',
    description: 'Carry-over additions resulting in sums between 11 and 18.',
    category: 'Addition',
    defaultConfig: { numberOfQuestions: 51, pageCount: 10, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const num1 = getRandomNumber(2, 9);
        const num2 = getRandomNumber(11 - num1, 9);
        const item = `${num1} + ${num2} = `;
        if (q.length > 0 && q.slice(-26).includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'sub_within_5',
    name: 'Subtraction Within 5',
    description: 'Subtraction equations within 5 (result >= 1).',
    category: 'Subtraction',
    defaultConfig: { numberOfQuestions: 51, pageCount: 10, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const num1 = getRandomNumber(2, 5);
        const num2 = getRandomNumber(1, num1 - 1);
        const item = `${num1} - ${num2} = `;
        if (q.length > 0 && q.slice(-7).includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'sub_within_10',
    name: 'Subtraction Within 10',
    description: 'Subtraction equations with minuends between 6 and 10.',
    category: 'Subtraction',
    defaultConfig: { numberOfQuestions: 51, pageCount: 10, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const num1 = getRandomNumber(6, 10);
        const num2 = getRandomNumber(1, num1 - 1);
        const item = `${num1} - ${num2} = `;
        if (q.length > 0 && q.slice(-7).includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'sub_within_20',
    name: 'Subtraction Within 20',
    description: 'Subtraction equations with minuends between 3 and 19.',
    category: 'Subtraction',
    defaultConfig: { numberOfQuestions: 51, pageCount: 10, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const num1 = getRandomNumber(3, 19);
        const num2 = getRandomNumber(2, num1 - 1);
        const item = `${num1} - ${num2} = `;
        if (q.includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'sub_teen_minus_single',
    name: 'Subtraction (Teen - Single)',
    description: 'minuend is 3-19, subtrahend is 2 to min(9, minuend).',
    category: 'Subtraction',
    defaultConfig: { numberOfQuestions: 51, pageCount: 10, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const num1 = getRandomNumber(3, 19);
        const num2 = getRandomNumber(2, Math.min(9, num1));
        const item = `${num1} - ${num2} = `;
        if (q.includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'sub_teen_minus_single_eq_single',
    name: 'Subtraction (Teen - Single = Single)',
    description: 'Minuend is 11-19, subtrahend is (minuend-9) to 10. Result is <= 9.',
    category: 'Subtraction',
    defaultConfig: { numberOfQuestions: 51, pageCount: 10, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const num1 = getRandomNumber(11, 19);
        const num2 = getRandomNumber(num1 - 9, 10);
        const item = `${num1} - ${num2} = `;
        if (q.length > 0 && q.slice(-30).includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'sub_teen_minus_single_eq_teen',
    name: 'Subtraction (Teen - Single = Teen)',
    description: 'Minuend is 11-19, result is >= 10.',
    category: 'Subtraction',
    defaultConfig: { numberOfQuestions: 51, pageCount: 10, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const num1 = getRandomNumber(11, 19);
        const num2 = getRandomNumber(1, num1 - 10);
        const item = `${num1} - ${num2} = `;
        if (q.length > 0 && q.slice(-30).includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'mixed_add_sub_within_5',
    name: 'Mixed Addition & Subtraction Within 5',
    description: 'Addition and Subtraction equations within 5.',
    category: 'Mixed',
    defaultConfig: { numberOfQuestions: 51, pageCount: 20, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        // Re-generate strictly to follow rules
        let equation = '';
        if (Math.random() < 0.5) {
          const num1 = getRandomNumber(1, 4);
          const num2 = getRandomNumber(1, 5 - num1);
          equation = `${num1} + ${num2} = `;
        } else {
          const num1 = getRandomNumber(2, 5);
          const num2 = getRandomNumber(1, num1 - 1);
          equation = `${num1} - ${num2} = `;
        }

        if (q.length > 0 && q.slice(-10).includes(equation)) continue;
        q.push(equation);
      }
      return q;
    }
  },
  {
    id: 'mixed_add_sub_within_10',
    name: 'Mixed Addition & Subtraction Within 10',
    description: 'Addition and Subtraction equations within 10.',
    category: 'Mixed',
    defaultConfig: { numberOfQuestions: 51, pageCount: 20, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        let equation = '';
        if (Math.random() < 0.5) {
          const num1 = getRandomNumber(1, 9);
          const num2 = getRandomNumber(1, 10 - num1);
          equation = `${num1} + ${num2} = `;
        } else {
          const num1 = getRandomNumber(2, 10);
          const num2 = getRandomNumber(1, num1 - 1);
          equation = `${num1} - ${num2} = `;
        }
        if (q.length > 0 && q.slice(-10).includes(equation)) continue;
        q.push(equation);
      }
      return q;
    }
  },
  {
    id: 'mixed_0_to_100',
    name: 'Mixed Addition & Subtraction 0 to 100',
    description: 'Operands and result are within 0 to 100.',
    category: 'Mixed',
    defaultConfig: { numberOfQuestions: 51, pageCount: 20, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        let equation = '';
        if (Math.random() > 0.5) {
          const num1 = getRandomNumber(1, 98);
          const num2 = getRandomNumber(1, 99 - num1);
          equation = `${num1} + ${num2} = `;
        } else {
          const num1 = getRandomNumber(2, 99);
          const num2 = getRandomNumber(1, num1 - 1);
          equation = `${num1} - ${num2} = `;
        }
        if (q.includes(equation)) continue;
        q.push(equation);
      }
      return q;
    }
  },
  {
    id: 'mixed_0_to_10000',
    name: 'Mixed Addition & Subtraction 0 to 10000',
    description: 'Larger range addition and subtraction up to 10,000.',
    category: 'Mixed',
    defaultConfig: { numberOfQuestions: 6, pageCount: 20, columns: 2, fontSize: 25, rowSpacing: 270 },
    generateQuestions: (count) => {
      const q: string[] = [];
      const MAX = 10000;
      while (q.length < count) {
        let equation = '';
        if (Math.random() > 0.5) {
          const num1 = getRandomNumber(0, MAX);
          const num2 = getRandomNumber(0, MAX - num1);
          equation = `${num1} + ${num2} = `;
        } else {
          const num1 = getRandomNumber(0, MAX);
          const num2 = getRandomNumber(0, num1);
          equation = `${num1} - ${num2} = `;
        }
        if (q.includes(equation)) continue;
        q.push(equation);
      }
      return q;
    }
  },
  {
    id: 'mixed_0_to_100_3_terms',
    name: 'Mixed 3-Term Operations 0 to 100',
    description: 'Double operation with brackets or sequential operands, keeping steps 0-100.',
    category: 'Mixed',
    defaultConfig: { numberOfQuestions: 34, pageCount: 20, columns: 2, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        let equation = '';
        try {
          if (Math.random() > 0.33) {
            // (a +/- b) +/- c
            const paran = Math.random() > 0.5;
            const num1 = getRandomNumber(2, 98);
            const add1 = Math.random() > 0.5;
            const num2 = add1 ? getRandomNumber(1, 99 - num1) : getRandomNumber(1, num1 - 1);
            const cur = num1 + (add1 ? num2 : -num2);
            const add2 = Math.random() > 0.5;
            const num3 = add2 ? getRandomNumber(1, 99 - cur) : getRandomNumber(1, cur - 1);
            const end = cur + (add2 ? num3 : -num3);

            if (end >= 0 && end <= 100) {
              equation = `${paran ? '(' : ''}${num1} ${add1 ? '+' : '-'} ${num2}${paran ? ')' : ''} ${add2 ? '+' : '-'} ${num3} = `;
            }
          } else {
            // a +/- (b +/- c)
            const num1 = getRandomNumber(2, 98);
            const add1 = Math.random() > 0.5;
            const num2 = add1 ? getRandomNumber(1, 99 - num1) : getRandomNumber(1, num1 - 1);
            const cur = num1 + (add1 ? num2 : -num2);
            const add2 = Math.random() > 0.5;
            const num3 = add2 ? getRandomNumber(1, 99 - cur) : getRandomNumber(cur + 1, 99);
            const end = num3 + (add2 ? cur : -cur);

            if (end >= 0 && end <= 100) {
              equation = `${num3} ${add2 ? '+' : '-'} (${num1} ${add1 ? '+' : '-'} ${num2}) = `;
            }
          }
        } catch {
          continue;
        }

        if (equation && !q.includes(equation)) {
          q.push(equation);
        }
      }
      return q;
    }
  },
  {
    id: 'mult_1_to_10',
    name: 'Multiplication 1 to 10',
    description: 'Basic single-digit multiplication from 1 to 10.',
    category: 'Multiplication & Division',
    defaultConfig: { numberOfQuestions: 51, pageCount: 20, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const num1 = getRandomNumber(1, 10);
        const num2 = getRandomNumber(1, 10);
        const item = `${num1} x ${num2} = `;
        if (q.includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'mixed_mult_div_to_10',
    name: 'Mixed Multiplication & Division to 10',
    description: 'Mixed single-digit multiplication and clean division problems.',
    category: 'Multiplication & Division',
    defaultConfig: { numberOfQuestions: 51, pageCount: 20, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const isMult = Math.random() > 0.5;
        let item = '';
        if (isMult) {
          item = `${getRandomNumber(1, 10)} x ${getRandomNumber(1, 10)} = `;
        } else {
          const num1 = getRandomNumber(1, 10);
          const num2 = getRandomNumber(1, 10);
          const num3 = num1 * num2;
          item = `${num3} ÷ ${num1} = `;
        }
        if (q.includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'mixed_all_ops_0_to_100',
    name: 'Mixed Operations 0 to 100',
    description: 'Random operations (+, -, x, ÷) with calculations within 100.',
    category: 'Mixed',
    defaultConfig: { numberOfQuestions: 51, pageCount: 20, columns: 3, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const n = Math.random();
        let item = '';
        if (n > 0.75) {
          const num1 = getRandomNumber(1, 10);
          const num2 = getRandomNumber(1, 10);
          item = `${num1 * num2} ÷ ${num1} = `;
        } else if (n > 0.5) {
          item = `${getRandomNumber(1, 10)} x ${getRandomNumber(1, 10)} = `;
        } else if (n > 0.25) {
          const num1 = getRandomNumber(1, 98);
          const num2 = getRandomNumber(1, 99 - num1);
          item = `${num1} + ${num2} = `;
        } else {
          const num1 = getRandomNumber(2, 99);
          const num2 = getRandomNumber(1, num1 - 1);
          item = `${num1} - ${num2} = `;
        }
        if (q.includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'mixed_all_ops_0_to_100_complex',
    name: 'Mixed Operations 0 to 100 (Complex)',
    description: 'Complex expressions using four operations and parenthetical precedence.',
    category: 'Mixed',
    defaultConfig: { numberOfQuestions: 34, pageCount: 20, columns: 2, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const equation = Math.random() > 0.5 ? genComplex1() : genComplex2();
        if (q.includes(equation)) continue;
        q.push(equation);
      }
      return q;
    }
  },
  {
    id: 'mixed_div_rem_add_sub',
    name: 'Division with Remainder, Add & Sub',
    description: 'Division equations with potential remainders, plus addition and subtraction.',
    category: 'Mixed',
    defaultConfig: { numberOfQuestions: 9, pageCount: 20, columns: 3, fontSize: 25, rowSpacing: 270 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const n = Math.random();
        let item = '';
        if (n > 0.66) {
          const num1 = getRandomNumber(1, 9);
          const num2 = getRandomNumber(1, 9);
          const num3 = num1 * num2 + getRandomNumber(0, num1 - 1);
          item = `${num3} ÷ ${num1} = `;
        } else if (n > 0.33) {
          const num1 = getRandomNumber(2, 99);
          const num2 = getRandomNumber(1, num1 - 1);
          item = `${num1} - ${num2} = `;
        } else {
          const num1 = getRandomNumber(1, 98);
          const num2 = getRandomNumber(1, 99 - num1);
          item = `${num1} + ${num2} = `;
        }
        if (q.includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'money_cny',
    name: 'CNY Money Addition & Subtraction',
    description: 'Yuan and Jiao currency addition and subtraction problems (supports Chinese).',
    category: 'CNY Money',
    defaultConfig: { numberOfQuestions: 16, pageCount: 20, columns: 1, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        let item = '';
        if (Math.random() > 0.5) {
          const num1 = getRandomNumber(1, 100);
          const num2 = getRandomNumber(1, 100);
          item = `${formatCNY(num1)} + ${formatCNY(num2)} = `;
        } else {
          const num1 = getRandomNumber(2, 100);
          const num2 = getRandomNumber(1, num1 - 1);
          item = `${formatCNY(num1)} - ${formatCNY(num2)} = `;
        }
        if (q.includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'money_cny_compare',
    name: 'CNY Money Comparison',
    description: 'Comparing various CNY currency sums in Yuan, Jiao, and Fen (supports Chinese).',
    category: 'CNY Money',
    defaultConfig: { numberOfQuestions: 16, pageCount: 20, columns: 1, fontSize: 25, rowSpacing: 40 },
    generateQuestions: (count) => {
      const q: string[] = [];
      while (q.length < count) {
        const num1 = getRandomNumber(1, 1000);
        const num2 = getRandomNumber(1, 1000);
        const item = `${formatCNYCompare(num1)} (   ) ${formatCNYCompare(num2)}`;
        if (q.includes(item)) continue;
        q.push(item);
      }
      return q;
    }
  },
  {
    id: 'print',
    name: 'Chinese Story Word Problems',
    description: 'Word problem worksheets pulled from 137 math story questions (supports Chinese).',
    category: 'Other',
    defaultConfig: { numberOfQuestions: 3, pageCount: 45, columns: 1, fontSize: 25, rowSpacing: 200 },
    generateQuestions: (count) => {
      // For Chinese story questions, print.js slices chunks of 3 questions sequentially or randomly.
      // We will draw randomly selected, non-repeating problems.
      const q: string[] = [];
      const shuffled = [...wordProblems].sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(count, shuffled.length); i++) {
        q.push(shuffled[i]);
      }
      return q;
    }
  }
];
