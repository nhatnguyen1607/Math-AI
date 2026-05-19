export const practiceScriptConfig = {
  enabled: true,
  levels: {
    canCoGang: {
      bai1: {
        deBai:
          'Hôm nay, Mai làm món salad cho gia đình. Trong 200 gam salad có 50 gam cà chua. Hỏi khối lượng cà chua chiếm bao nhiêu phần trăm so với tổng khối lượng salad?',
        aiMessages: [
          'Chào bạn! Mình là Chuyên gia dinh dưỡng. Trước tiên, bạn hãy cho mình biết bài toán đã cho biết những thông tin gì?',
          'Tuyệt vời! Nhưng trong món salad còn có thành phần nào nữa nhỉ?',
          'Tốt lắm! Vậy cà chua có khối lượng là bao nhiêu?',
          'Chính xác! Nhưng mình thấy bạn vẫn chưa tìm ra yêu cầu của bài toán. Bạn hãy đọc kỹ lại câu hỏi cuối cùng của bài toán để biết mình cần tìm gì nhé!',
          'Chính xác! Bạn đã nắm rõ được thông tin bài toán và điều cần tìm. Vậy bây giờ, bạn sẽ giải bài này bằng cách nào?',
          'Bạn hãy thử đọc lại yêu cầu của bài toán và cho mình biết bạn sẽ giải bài này bằng cách nào nhé!',
          'Tuyệt vời! Vậy để tính tỉ số phần trăm của khối lượng cà chua so với tổng khối lượng salad, ta làm thế nào nhỉ?',
          'Bạn đã làm rất tốt! Tuy nhiên, khi tìm thương của khối lượng cà chua và tổng khối lượng salad, kết quả đó đã đúng dạng tỉ số phần trăm chưa nhỉ?',
          'Không sao đâu! Mình gợi ý cho bạn nhé: ví dụ 0,5 = 50%. Theo bạn, ta cần làm thế nào để chuyển 0,5 thành 50%?',
          'Chính xác! Vậy bây giờ bạn hãy nêu lại đầy đủ các bước để tính tỉ số phần trăm của khối lượng cà chua so với tổng khối lượng salad nhé!',
          'Bạn đã rất cố gắng rồi! Tuy nhiên cách tính của bạn vẫn chưa đúng. Bạn hãy cho mình biết trong bài toán này đâu là số thành phần? Đâu là tổng số?',
          'Chính xác! Vậy bạn thử kiểm tra lại xem cách tính tỉ số phần trăm khối lượng cà chua so với tổng khối lượng salad đã đúng chưa? Bạn hãy trình bày lại cách tính nhé.',
          'Chính xác! Bây giờ, hãy thực hiện theo kế hoạch bạn vừa đề ra nhé. Để tìm tỉ số phần trăm của khối lượng cà chua và tổng khối lượng salad, bước đầu ta làm phép tính gì?',
          'Làm tốt lắm! Sau khi tìm thương của khối lượng cà chua và khối lượng salad, bước tiếp theo bạn sẽ làm gì?',
          'Kết quả của bạn đưa ra chưa đúng lắm. Bạn hãy kiểm tra lại dấu phẩy trong kết quả phép tính 0,25 x 100 đã đặt đúng chưa nhé! Khi nhân một số thập phân với 100 thì mình chuyển dấu phẩy sang bên phải mấy chữ số?',
          'Chính xác! Vậy bạn hãy trình bày lại phép tính cho mình nhé!',
          'Chính xác rồi! Bạn hãy trình bày lại đầy đủ bài giải gồm lời giải, phép tính, đáp số nhé!',
          'Chính xác! Khối lượng cà chua chiếm 25% so với tổng khối lượng salad. Theo bạn, muốn biết 0,25 có phải là kết quả của 50 : 200 thì ta làm thế nào?',
          'Không sao cả! Bạn hãy cùng mình quan sát sơ đồ phép tính sau:\n50 — (: 200) ──→ 0,25\n50 ←──   (?)   ── 0,25\nỞ dòng trên, mình lấy 50 : 200 để được 0,25. Vậy bây giờ nếu muốn chuyển 0,25 thành 50, theo bạn mình cần phải làm thế nào nhỉ?',
          'Rất tốt! Vậy theo bạn, phép tính ngược của 50 : 200 = 0,25 sẽ là phép tính nào?',
          'Chưa chính xác! Mình cùng xem lại nhé. Ta có x : 200 = 0,25. Trong phép tính này, x là số bị chia. Theo bạn, muốn tìm số bị chia thì mình làm thế nào?',
          'Chính xác rồi! Vậy theo bạn, phép tính ngược của 50 : 200 = 0,25 sẽ là phép tính nào?',
          'Chính xác! Vậy kết quả này có phải là khối lượng cà chua mà đề bài đã cho ban đầu không?',
          'Đáp án của bạn hoàn toàn chính xác rồi đó! Chúc mừng bạn đã hoàn thành bài tập!'
        ],
        aiStatuses: [
          'thinking',
          'correct',
          'correct',
          'wrong',
          'correct',
          'wrong',
          'correct',
          'wrong',
          'wrong',
          'correct',
          'wrong',
          'correct',
          'correct',
          'correct',
          'wrong',
          'correct',
          'correct',
          'correct',
          'wrong',
          'correct',
          'wrong',
          'correct',
          'correct',
          'correct'
        ]
      },
      bai2: {
        deBai:
          'Trong bữa trưa, Mai ăn 750 kcal, Việt ăn 1250 kcal. Hỏi lượng kcal Mai đã ăn chiếm bao nhiêu phần trăm tổng lượng kcal của cả hai bạn?'
      }
    },
    dat: {
      bai1: {
        deBai:
          'Buổi sáng, Mai ăn một bát phở cung cấp 450 calo và một quả chuối cung cấp 90 calo. Việt ăn một suất xôi cung cấp 600 kcal. Hỏi tổng lượng calo Mai đã ăn bằng bao nhiêu phần trăm lượng calo Việt đã ăn?',
        aiMessages: [
          'Chào bạn! Mình là Chuyên gia dinh dưỡng. Trước tiên, bạn hãy cho mình biết bài toán đã cho biết những thông tin gì?',
          'Chính xác! Nhưng mình thấy bạn vẫn chưa tìm ra yêu cầu của bài toán. Bạn hãy đọc kỹ lại câu hỏi cuối cùng của bài toán để biết mình cần tìm gì nhé!',
          'Chính xác! Bạn đã nắm rõ được thông tin bài toán và điều cần tìm. Vậy bây giờ, bạn sẽ giải bài này bằng cách nào?',
          'Bạn đã xác định đúng hướng rồi đó. Tuy nhiên, kế hoạch của bạn vẫn chưa đầy đủ. Vậy để có thể tính ra tổng lượng calo Mai đã ăn thì mình sẽ làm thế nào nhỉ?',
          'Chính xác! Vậy bây giờ bạn hãy nêu lại đầy đủ các bước để tính tổng lượng calo của Mai bằng bao nhiêu phần trăm tổng lượng calo của Việt đã ăn nhé!',
          'Tuyệt vời! Bây giờ bạn hãy bắt đầu giải bài theo kế hoạch nhé!Trình bày lời giải đầy đủ, viết rõ từng bước và nhớ kèm theo đơn vị nhé.',
          'Tuyệt vời! Bạn đã thực hiện các phép tính đúng rồi! Tuy nhiên, lời giải của bạn vẫn chưa đầy đủ các thành phần, bạn hãy trình bày lại lời giải của mình để đáp ứng với kế hoạch mà bạn đã đưa ra nhé!',
          'Bạn thật xuất sắc! Tổng lượng calo của Mai chiếm 90% so với lượng calo Việt đã ăn! Theo bạn, muốn biết 0,9 có phải là kết quả của 540 : 600 thì ta làm như thế nào?',
          'Rất tốt! Tuy nhiên, bạn hãy cho mình biết phép tính ngược của 540 : 600 = 0,9 là phép tính nào?',
          'Chưa chính xác! Mình cùng xem lại nhé. Ta có x : 600 = 0,9. Trong phép tính này,  x là số bị chia. Theo bạn, muốn tìm số bị chia thì mình làm thế nào?',
          'Chính xác rồi! Vậy theo bạn, phép tính ngược của 540 : 600 = 0,9 sẽ là phép tính nào?',
          'Chính xác! Vậy kết quả này có phải là tổng lượng  calo của Mai mà đề bài đã cho ban đầu không?',
          'Đáp án của bạn hoàn toàn chính xác rồi đó! Chúc mừng bạn đã hoàn thành bài tập!'
        ],
        aiStatuses: [
          'thinking',
          'wrong',
          'correct',
          'wrong',
          'correct',
          'correct',
          'wrong',
          'correct',
          'wrong',
          'wrong',
          'correct',
          'correct',
          'correct'
        ]
      },
      bai2: {
        deBai:
          'Mai và Nam chuẩn bị bữa trưa. Mai dùng 150 gam thịt, Nam dùng 250 gam thịt. Khối lượng thịt Mai sử dụng bằng bao nhiêu phần trăm tổng khối lượng thịt cả hai bạn đã sử dụng?'
      }
    },
    tot: {
      bai1: {
        deBai:
          'Mai có 12 gam chất xơ. Việt có lượng chất xơ gấp 3 lần lượng chất xơ của Mai. Nam, người ăn cùng, cần tổng cộng 60 gam chất xơ. Hỏi lượng chất xơ của Mai và Việt đã chuẩn bị chiếm bao nhiêu phần trăm tổng lượng chất xơ Nam cần?',
        aiMessages: [
          'Chào bạn! Mình là Chuyên gia dinh dưỡng. Trước tiên, bạn hãy cho mình biết bài toán đã cho biết những thông tin gì?',
          'Chính xác! Bạn đã nắm rõ được thông tin bài toán và điều cần tìm. Vậy bây giờ, bạn sẽ giải bài này bằng cách nào?',
          'Tuyệt vời! Vậy để tính tỉ số phần trăm của lượng chất xơ của Mai và Việt so với lượng chất xơ Nam cần, ta làm thế nào nhỉ?',
          'Chính xác! Vậy bây giờ, bạn hãy trình bày lại đầy đủ các bước để giải bài này nhé!',
          'Chính xác! Bây giờ, hãy thực hiện theo kế hoạch bạn vừa đề ra nhé.',
          'Chính xác! Bạn đã tính toán được tỉ số phần trăm chất xơ của Mai và Việt đã chuẩn bị so với tổng lượng chất xơ Nam cần là 80%. Theo bạn để kiểm tra lại trên quả vừa tìm ta sẽ làm thế nào?',
          'Ý tưởng rất hay! Vậy bạn hãy vận dụng cách đó và thực hiện phép kiểm tra nhé.',
          'Rất tốt! Kết quả tìm được có trùng với tổng lượng chất xơ của Mai và Việt đã chuẩn bị không?',
          'Chính xác! Như vậy kết quả 80% là phù hợp và bài giải của bạn đã đúng rồi. Bạn hãy nộp bài luyện tập này bằng cách nhấn nút "Nộp bài" ở dưới để mình chấm điểm nhé!'
        ],
        aiStatuses: [
          'thinking',
          'correct',
          'correct',
          'correct',
          'correct',
          'correct',
          'correct',
          'correct',
          'correct'
        ]
      },
      bai2: {
        deBai:
          'Mai và Việt cùng chuẩn bị rau củ cho món súp. Họ cần tổng cộng 2,5 kg rau củ. Mai đảm nhận 2/5 tổng số rau củ, phần còn lại là của Việt. Hỏi tỉ số phần trăm khối lượng rau củ Việt chuẩn bị so với Mai là bao nhiêu?'
      }
    }
  }
};

const normalizeCompetencyLevel = (level) => {
  if (typeof level === 'number' && Number.isFinite(level)) {
    if (level >= 7) return 'tot';
    if (level >= 4) return 'dat';
    return 'canCoGang';
  }

  const normalized = String(level || '').trim().toLowerCase();
  const numericLevel = Number(normalized.replace(',', '.'));
  if (Number.isFinite(numericLevel)) {
    if (numericLevel >= 7) return 'tot';
    if (numericLevel >= 4) return 'dat';
    return 'canCoGang';
  }

  if (/(tot|tốt)/i.test(normalized)) return 'tot';
  if (/(dat|đạt)/i.test(normalized)) return 'dat';
  return 'canCoGang';
};

const getPracticeScriptLevelConfig = (competencyLevel) => {
  const levelKey = normalizeCompetencyLevel(competencyLevel);
  return practiceScriptConfig.levels?.[levelKey] || practiceScriptConfig.levels?.canCoGang || {};
};

export const getPracticeScriptProblem = (baiNumber, competencyLevel) => {
  if (!practiceScriptConfig.enabled) return '';
  const levelConfig = getPracticeScriptLevelConfig(competencyLevel);
  if (baiNumber === 'bai1') return levelConfig.bai1?.deBai || '';
  if (baiNumber === 'bai2') return levelConfig.bai2?.deBai || '';
  return '';
};

export const getPracticeScriptMessages = (baiNumber, competencyLevel) => {
  if (!practiceScriptConfig.enabled) return [];
  const levelConfig = getPracticeScriptLevelConfig(competencyLevel);
  if (baiNumber === 'bai1') return levelConfig.bai1?.aiMessages || [];
  return [];
};

export const getPracticeScriptStatus = (baiNumber, aiIndex, competencyLevel) => {
  if (!practiceScriptConfig.enabled) return '';
  if (baiNumber !== 'bai1') return '';
  const levelConfig = getPracticeScriptLevelConfig(competencyLevel);
  const statuses = levelConfig.bai1?.aiStatuses || [];
  if (Number.isInteger(aiIndex) && aiIndex >= 0 && aiIndex < statuses.length) {
    return statuses[aiIndex] || '';
  }
  return '';
};

export const getScriptedReplyDelayMs = (text) => {
  const base = 500;
  const perChar = 18;
  const max = 6000;
  const length = typeof text === 'string' ? text.length : 0;
  return Math.min(max, base + length * perChar);
};
