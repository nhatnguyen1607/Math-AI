export const practiceScriptConfig = {
  enabled: true,
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
};

export const getPracticeScriptProblem = (baiNumber) => {
  if (!practiceScriptConfig.enabled) return '';
  if (baiNumber === 'bai1') return practiceScriptConfig.bai1.deBai;
  if (baiNumber === 'bai2') return practiceScriptConfig.bai2?.deBai || '';
  return '';
};

export const getPracticeScriptMessages = (baiNumber) => {
  if (!practiceScriptConfig.enabled) return [];
  if (baiNumber === 'bai1') return practiceScriptConfig.bai1.aiMessages || [];
  return [];
};

export const getPracticeScriptStatus = (baiNumber, aiIndex) => {
  if (!practiceScriptConfig.enabled) return '';
  if (baiNumber !== 'bai1') return '';
  const statuses = practiceScriptConfig.bai1.aiStatuses || [];
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
