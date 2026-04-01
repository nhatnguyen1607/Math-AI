import geminiModelManager from './geminiModelManager';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class StudentEvaluationService {
  constructor() {
    this._pending = Promise.resolve();
  }

  _safeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    return String(value).trim() || fallback;
  }

  _inferKhoiDongWeakSkills(questionReviews = []) {
    const wrongItems = (questionReviews || [])
      .filter((item) => this._safeText(item?.result).toLowerCase() === 'sai');

    const score = {
      xacDinhYeuCau: 0,
      tinhToan: 0,
      kiemTraLai: 0
    };

    wrongItems.forEach((item) => {
      const raw = `${this._safeText(item?.comment)} ${this._safeText(item?.studentAnswer)}`.toLowerCase();

      if (/(đề|yêu cầu|dữ kiện|từ khóa|đơn vị|đọc kỹ)/.test(raw)) {
        score.xacDinhYeuCau += 1;
      }
      if (/(tính|phép|cộng|trừ|nhân|chia|đổi|kết quả|phút|giờ|km|m|số)/.test(raw)) {
        score.tinhToan += 1;
      }
      if (/(kiểm tra|soát|đối chiếu|hợp lý|thử lại|xem lại)/.test(raw)) {
        score.kiemTraLai += 1;
      }
    });

    const labeled = [
      {
        key: 'xacDinhYeuCau',
        score: score.xacDinhYeuCau,
        title: 'xác định yêu cầu của đề',
        tip: 'Đọc chậm đề, gạch chân dữ kiện và câu hỏi chính trước khi chọn đáp án.'
      },
      {
        key: 'tinhToan',
        score: score.tinhToan,
        title: 'thực hiện tính toán',
        tip: 'Viết phép tính ra nháp từng bước, chú ý đổi đơn vị trước khi tính.'
      },
      {
        key: 'kiemTraLai',
        score: score.kiemTraLai,
        title: 'kiểm tra lại đáp án',
        tip: 'Trước khi chốt, đối chiếu đáp án với dữ kiện để tránh sai sót nhỏ.'
      }
    ].sort((a, b) => b.score - a.score);

    const positive = labeled.filter((item) => item.score > 0);
    if (positive.length === 0) {
      if (wrongItems.length > 0) {
        return [
          {
            title: 'thực hiện tính toán',
            tip: 'Bạn nên viết lại phép tính từng bước và kiểm tra đơn vị trước khi chọn đáp án.'
          }
        ];
      }
      return [];
    }

    return positive.slice(0, 2).map((item) => ({ title: item.title, tip: item.tip }));
  }

  _buildKhoiDongWeaknessSummary(questionReviews = []) {
    const weakSkills = this._inferKhoiDongWeakSkills(questionReviews);

    if (weakSkills.length === 0) {
      return '- Bạn không có điểm yếu nổi bật ở phần này.';
    }

    return weakSkills
      .map((item) => `- Điểm cần cải thiện: ${item.title}. Gợi ý: ${item.tip}`)
      .join('\n');
  }

  _buildKhoiDongFallback({ correctAnswers = 0, totalQuestions = 0, questionReviews = [] }) {
    const weakSkills = this._inferKhoiDongWeakSkills(questionReviews);
    const ratio = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;

    const weakTitles = weakSkills.map((s) => s.title).join(' và ');
    const mainTip = weakSkills.length > 0 ? weakSkills[0].tip : '';

    if (ratio === 1) {
      return `Tuyệt vời quá! Bạn đã xuất sắc hoàn thành phần Khởi động với điểm tuyệt đối ${correctAnswers}/${totalQuestions}. Điểm mạnh lớn nhất của bạn là sự cẩn thận và nắm rất vững kiến thức cơ bản. Trộm vía là bạn không có điểm yếu nào đáng kể ở phần này. Hãy tiếp tục phát huy phong độ đỉnh cao này và luôn giữ thói quen tự kiểm tra lại bài nhé. Chúc mừng bạn!`;
    }

    if (ratio >= 0.8) {
      const weaknessText = weakSkills.length > 0
        ? `Chỉ có một chút xíu nhầm lẫn ở phần ${weakTitles}. ${mainTip}`
        : `Bạn làm bài rất mượt và ít mắc lỗi vặt.`;
      return `Làm tốt lắm! Bạn đã hoàn thành phần Khởi động với ${correctAnswers}/${totalQuestions} câu đúng. Điểm mạnh của bạn là hiểu bài khá chắc và xử lý các câu hỏi rất trơn tru. ${weaknessText} Mình tin là nếu cẩn thận thêm một chút xíu nữa, bạn sẽ đạt điểm tuyệt đối ở lần sau!`;
    }

    if (ratio >= 0.5) {
      const weaknessText = weakSkills.length > 0
        ? `Để điểm cao hơn, bạn cần rèn luyện thêm kỹ năng ${weakTitles}. ${mainTip}`
        : `Tuy nhiên, bạn cần đọc kỹ đề hơn ở một số câu đánh lừa để không mất điểm oan nhé.`;
      return `Hoan hô tinh thần học tập của bạn! Bạn đã làm đúng ${correctAnswers}/${totalQuestions} câu. Điểm đáng khen là bạn đã không bỏ cuộc và kiên trì suy nghĩ đến tận câu cuối cùng. ${weaknessText} Lần sau cứ bình tĩnh làm từng bước nhé, bạn đang tiến bộ rất tốt!`;
    }

    const weaknessText = weakSkills.length > 0
      ? `Có vẻ bạn đang gặp bối rối ở phần ${weakTitles}. Gợi ý nhỏ cho bạn nè: ${mainTip}`
      : `Có lẽ bạn hơi vội vàng một chút khi làm bài. Hãy nhớ lấy nháp ra tính toán cẩn thận hơn nhé.`;
    return `Mình thấy bạn đã nỗ lực hết sức để hoàn thành bài Khởi động, dù kết quả mới đạt ${correctAnswers}/${totalQuestions} câu. Không sao cả, học Toán là quá trình phát hiện và sửa sai mà! Điểm cộng lớn nhất của bạn là thái độ học tập vô cùng nghiêm túc. ${weaknessText} Đừng nản chí, mình sẽ luôn đồng hành cùng bạn. Cố lên nhé!`;
  }

  _extractPracticeWeakSkillsFromTeacherEvaluation(teacherEvaluation = null) {
    if (!teacherEvaluation || typeof teacherEvaluation !== 'object') {
      return [];
    }

    const scoreFrom = (val) => {
      if (val === null || val === undefined) return null;
      const n = Number(val);
      return Number.isNaN(n) ? null : n;
    };

    const tcData = [
      {
        tc: 'TC1',
        label: 'xác định yêu cầu và dữ kiện của đề',
        tip: 'Hãy gạch chân dữ kiện quan trọng và xác định câu hỏi chính trước khi làm.',
        score: scoreFrom(teacherEvaluation?.TC1?.diem ?? teacherEvaluation?.diemTC?.tc1),
        note: this._safeText(teacherEvaluation?.TC1?.nhanXet)
      },
      {
        tc: 'TC2',
        label: 'lập cách làm và chọn phép tính phù hợp',
        tip: 'Bạn nên tóm tắt kế hoạch giải bằng 1-2 bước trước khi tính toán.',
        score: scoreFrom(teacherEvaluation?.TC2?.diem ?? teacherEvaluation?.diemTC?.tc2),
        note: this._safeText(teacherEvaluation?.TC2?.nhanXet)
      },
      {
        tc: 'TC3',
        label: 'thực hiện tính toán cẩn thận',
        tip: 'Viết phép tính rõ ràng từng dòng và chú ý đổi đơn vị trước khi tính.',
        score: scoreFrom(teacherEvaluation?.TC3?.diem ?? teacherEvaluation?.diemTC?.tc3),
        note: this._safeText(teacherEvaluation?.TC3?.nhanXet)
      },
      {
        tc: 'TC4',
        label: 'kiểm tra và giải thích kết quả',
        tip: 'Sau khi ra đáp án, hãy thử kiểm tra ngược để xem kết quả có hợp lý không.',
        score: scoreFrom(teacherEvaluation?.TC4?.diem ?? teacherEvaluation?.diemTC?.tc4),
        note: this._safeText(teacherEvaluation?.TC4?.nhanXet)
      }
    ];

    const withScore = tcData.filter((item) => item.score !== null);
    if (withScore.length === 0) {
      return [];
    }

    const weakSorted = withScore
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)
      .map((item) => ({
        label: item.label,
        tip: item.tip,
        note: item.note
      }));

    return weakSorted;
  }

  _extractPracticeStrongSkillsFromTeacherEvaluation(teacherEvaluation = null) {
    if (!teacherEvaluation || typeof teacherEvaluation !== 'object') {
      return [];
    }

    const scoreFrom = (val) => {
      if (val === null || val === undefined) return null;
      const n = Number(val);
      return Number.isNaN(n) ? null : n;
    };

    const tcData = [
      {
        label: 'xác định yêu cầu và dữ kiện của đề',
        score: scoreFrom(teacherEvaluation?.TC1?.diem ?? teacherEvaluation?.diemTC?.tc1)
      },
      {
        label: 'lập cách làm và chọn phép tính phù hợp',
        score: scoreFrom(teacherEvaluation?.TC2?.diem ?? teacherEvaluation?.diemTC?.tc2)
      },
      {
        label: 'thực hiện tính toán cẩn thận',
        score: scoreFrom(teacherEvaluation?.TC3?.diem ?? teacherEvaluation?.diemTC?.tc3)
      },
      {
        label: 'kiểm tra và giải thích kết quả',
        score: scoreFrom(teacherEvaluation?.TC4?.diem ?? teacherEvaluation?.diemTC?.tc4)
      }
    ];

    const withScore = tcData.filter((item) => item.score !== null);
    if (withScore.length === 0) {
      return [];
    }

    return withScore
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((item) => item.label);
  }

  _summarizePracticeChat(chatHistory = []) {
    const messages = Array.isArray(chatHistory) ? chatHistory : [];
    const userMessages = messages.filter((m) => m?.role === 'user');
    const userTextList = userMessages.map((m) => this._safeText(m?.parts?.[0]?.text || m?.text || ''));

    const userTurns = userTextList.filter(Boolean).length;
    const questionTurns = userTextList.filter((t) => t.includes('?')).length;
    const hintLikeTurns = userTextList.filter((t) => /(gợi ý|không hiểu|khó|giúp|hint|chỉ)/i.test(t)).length;

    return {
      userTurns,
      questionTurns,
      hintLikeTurns
    };
  }

  _analyzeChatForSpecificMistakes(chatHistory = [], problemText = '') {
    const messages = Array.isArray(chatHistory) ? chatHistory : [];
    const userMessages = messages.filter((m) => m?.role === 'user');
    const assistantMessages = messages.filter((m) => m?.role === 'model' || m?.role === 'assistant');
    
    const analysis = {
      userTurns: userMessages.length,
      askedForHints: 0,
      askedAboutErrors: 0,
      specifiedErrors: [],
      lastAnswerAttempt: '',
      correctionTurns: 0
    };

    // Analyze user messages for patterns
    userMessages.forEach((msg) => {
      const text = this._safeText(msg?.parts?.[0]?.text || msg?.text || '').toLowerCase();
      
      if (/(gợi ý|không hiểu|khó|giúp|hint|chỉ|hướng dẫn)/i.test(text)) {
        analysis.askedForHints += 1;
      }
      if (/(sai|lỗi|không đúng|mình sai rồi|tại sao)/i.test(text)) {
        analysis.askedAboutErrors += 1;
        const errorMatch = text.match(/(?:tính được|ra|kết quả|đáp án)?\s*(\d+[,.]?\d*)\s*(?:phút|giờ|km|m|times|lần)?/);
        if (errorMatch && errorMatch[1]) {
          analysis.specifiedErrors.push(errorMatch[1]);
        }
      }
    });

    // Count correction turns (when user corrects themselves)
    if (analysis.askedAboutErrors > 0) {
      analysis.correctionTurns = Math.ceil(analysis.askedAboutErrors / 1.5);
    }

    // Get last user answer attempt
    if (userMessages.length > 0) {
      const lastMsg = userMessages[userMessages.length - 1];
      analysis.lastAnswerAttempt = this._safeText(lastMsg?.parts?.[0]?.text || lastMsg?.text || '').slice(0, 100);
    }

    return analysis;
  }

  _buildPracticeFallbackWithChatAnalysis({ 
    baiNumber = 'bai1', 
    teacherEvaluation = null, 
    chatHistory = [], 
    problemText = '' 
  }) {
    const weakSkills = this._extractPracticeWeakSkillsFromTeacherEvaluation(teacherEvaluation);
    const strongSkills = this._extractPracticeStrongSkillsFromTeacherEvaluation(teacherEvaluation);
    const chatAnalysis = this._analyzeChatForSpecificMistakes(chatHistory, problemText);
    const shortProblem = this._safeText(problemText).slice(0, 120);
    const isBai1 = baiNumber === 'bai1';

    // Determine student's engagement level
    const hasAskedForHelp = chatAnalysis.askedForHints > 0;
    const hasMadeMistakes = chatAnalysis.askedAboutErrors > 0;
    const manyInteractions = chatAnalysis.userTurns >= 4;

    if (weakSkills.length === 0) {
      const opening = isBai1
        ? 'Khởi đầu phần Luyện tập rất mượt mà! Bạn đang xử lý Bài 1 vô cùng tốt.'
        : 'Tuyệt vời! Bạn đã vượt qua Bài 2 với phong độ cực kỳ ấn tượng.';
      
      const engagement = !hasAskedForHelp 
        ? 'Điểm cộng lớn nhất là bạn tự tin giải quyết mà không cần gợi ý, rất độc lập và chắc chắn.'
        : 'Điểm cộng là bạn không ngại hỏi để làm rõ bài, điều này cho thấy tinh thần học tập tích cực.';
      
      return `${opening} Điểm mạnh: ${engagement} Điểm cần cải thiện: hiện chưa có điểm yếu nổi bật, bạn chỉ cần giữ thói quen kiểm tra lại đáp án trước khi chốt. Hãy giữ vững cách phân tích đề sắc bén như hiện tại nhé!`;
    }

    // Build specific feedback based on chat analysis
    let opening = '';
    if (isBai1) {
      if (!hasAskedForHelp && !hasMadeMistakes) {
        opening = 'Bạn đang làm Bài 1 rất tự tin và độc lập! Mình rất khen ngợi sự kiên trì của bạn.';
      } else if (hasAskedForHelp || hasMadeMistakes) {
        opening = 'Bạn đang làm Bài 1 với tinh thần rất tích cực, mình rất khen ngợi sự kiên trì và không sợ khó của bạn!';
      }
    } else {
      if (!hasAskedForHelp && !hasMadeMistakes) {
        opening = 'Bạn đã tiến tới Bài 2 rồi! Sự cố gắng không ngừng của bạn thực sự đáng ghi nhận.';
      } else if (hasAskedForHelp || hasMadeMistakes) {
        opening = 'Bạn đã đi đến Bài 2 của phần Luyện tập rồi - một nỗ lực rất đáng ghi nhận!';
      }
    }

    // Specific weakness feedback
    const weakLabel = weakSkills[0]?.label || 'xác định yêu cầu';
    let weakText = `Điểm cần cải thiện: ${weakLabel}.`;
    
    if (chatAnalysis.specifiedErrors.length > 0) {
      weakText = `Điểm cần cải thiện: ${weakLabel}, vì bạn còn nhầm khi xử lý số liệu và chọn phép tính.`;
    } else if (hasMadeMistakes) {
      weakText = `Điểm cần cải thiện: ${weakLabel}; bạn đã tự phát hiện lỗi, nhưng vẫn cần ổn định hơn để tránh sai lặp lại.`;
    }

    const strongFromTeacher = strongSkills[0] || 'tinh thần kiên trì khi giải bài';
    let strongText = `Điểm mạnh: ${strongFromTeacher}.`;
    if (!hasAskedForHelp && !hasMadeMistakes) {
      strongText = 'Điểm mạnh: bạn làm khá độc lập, bám đề tốt và giữ được mạch giải ổn định.';
    } else if (hasMadeMistakes) {
      strongText = 'Điểm mạnh: bạn có tinh thần tự sửa sai, không bỏ cuộc khi gặp bước khó.';
    } else if (hasAskedForHelp) {
      strongText = 'Điểm mạnh: bạn biết hỏi đúng lúc khi vướng, nên tiến độ giải vẫn được duy trì.';
    }

    const tipText = weakSkills[0]?.tip || 'Hãy đọc kỹ đề, làm từng bước và kiểm tra lại kết quả.';
    
    // Add second tip if asking for hints
    let additionalTip = '';
    if (weakSkills[1]) {
      additionalTip = ` Bên cạnh đó, ${weakSkills[1].tip.toLowerCase()}`;
    } else if (hasAskedForHelp) {
      additionalTip = ' Nhớ rằng, cứ chia nhỏ bài toán ra và làm từng bước sẽ giúp bạn tránh nhầm lẫn nhiều hơn nhé.';
    }

    // Problem-specific advice
    const problemAdvice = shortProblem 
      ? `Với dạng bài như "${shortProblem}...", bạn nên tóm tắt dữ kiện trước rồi mới chọn phép tính phù hợp.`
      : 'Khi chưa chắc cách làm, bạn hãy chia nhỏ bài toán thành 1-2 bước rồi tính từng bước.';

    return `${opening} ${strongText} ${weakText} Lỗi thường gặp hiện tại là dễ chọn phép tính khi chưa tóm tắt đủ dữ kiện. Gợi ý: ${tipText}${additionalTip} ${problemAdvice} Cứ bình tĩnh, mình tin rằng bạn sẽ làm tốt hơn ở lần tới!`;
  }

  _buildPracticeFallback({ baiNumber = 'bai1', teacherEvaluation = null, chatHistory = [], problemText = '' }) {
    // Use enhanced version that analyzes chat history
    return this._buildPracticeFallbackWithChatAnalysis({ baiNumber, teacherEvaluation, chatHistory, problemText });
  }

  _buildVanDungFallbackWithChatAnalysis({ status = '', teacherEvaluation = null, chatHistory = [], problemText = '' }) {
    const weakSkills = this._extractPracticeWeakSkillsFromTeacherEvaluation(teacherEvaluation);
    const strongSkills = this._extractPracticeStrongSkillsFromTeacherEvaluation(teacherEvaluation);
    const chatAnalysis = this._analyzeChatForSpecificMistakes(chatHistory, problemText);
    const shortProblem = this._safeText(problemText).slice(0, 110);

    const isCompleted = status === 'completed';
    const hasAskedForHelp = chatAnalysis.askedForHints > 0;
    const hasMadeMistakes = chatAnalysis.askedAboutErrors > 0;

    if (isCompleted) {
      if (weakSkills.length === 0) {
        const engagement = !hasAskedForHelp
          ? 'Điểm sáng rực rỡ nhất là bạn tự tin áp dụng kiến thức mà không cần hỗ trợ thêm.'
          : 'Mặc dù có xin gợi ý, bạn vẫn kiên trì tìm ra được đáp án đúng - điều này rất đáng khen.';
        return `Chúc mừng bạn chinh phục thành công phần Vận dụng! Điểm mạnh: ${engagement} Điểm cần cải thiện: hiện chưa có điểm yếu nổi bật, bạn chỉ cần giữ thói quen kiểm tra lại kết quả trước khi chốt. Xuất sắc lắm, hãy luôn giữ niềm đam mê với môn Toán nhé!`;
      } else {
        const challenges = weakSkills.map((w) => w.label).join(' và ');
        const strongLabel = strongSkills[0] || 'tư duy liên hệ thực tế';
        let adviceForCompleted = '';
        if (hasMadeMistakes) {
          adviceForCompleted = `Lỗi thường gặp là còn vướng ở phần ${challenges}, nhưng bạn đã không bỏ cuộc và tìm ra đáp án cuối cùng.`;
        } else {
          adviceForCompleted = `Điểm cần cải thiện: ${challenges}.`;
        }
        const nextStep = weakSkills[0]?.tip || 'Hãy tóm tắt dữ kiện và kiểm tra lại kết quả một lần nữa.';
        return `Hoan hô! Bạn đã hoàn thành phần Vận dụng với nỗ lực rất đáng tự hào. Điểm mạnh: ${strongLabel}. ${adviceForCompleted} Gợi ý để lần tới hoàn hảo hơn: ${nextStep} Chúc mừng sự cố gắng của bạn!`;
      }
    } else {
      // Not completed
      const encouragement = hasAskedForHelp
        ? 'Bạn đang đi rất đúng hướng rồi! Việc biết xin gợi ý khi cần là dấu hiệu của một học sinh thực sự muốn học tốt.'
        : 'Bạn đang đi rất đúng hướng ở phần Vận dụng rồi, chỉ cần thêm một chút kiên trì nữa thôi!';
      
      let difficulties = '';
      if (weakSkills.length > 0) {
        difficulties = `Điểm cần cải thiện: ${weakSkills.map((w) => w.label).join(' và ')}.`;
      } else {
        difficulties = 'Điểm cần cải thiện: cần tóm tắt dữ kiện rõ hơn trước khi chọn phép tính.';
      }
      
      const hint = weakSkills[0]?.tip || 'Hãy thử đọc lại đề thật chậm và gạch chân các con số quan trọng xem sao.';
      const strongLabel = strongSkills[0] || 'bạn vẫn giữ được tinh thần bám bài';
      
      return `${encouragement} Điểm mạnh: ${strongLabel}. ${difficulties} Lỗi thường gặp là làm phép tính khi chưa kiểm tra đủ dữ kiện. ${hint} Hãy thử vẽ sơ đồ hoặc tóm tắt lại xem sao. Cố lên, mình tin là bạn sẽ tìm ra đáp án ngay thôi!`;
    }
  }

  _buildVanDungFallback({ status = '', teacherEvaluation = null, chatHistory = [], problemText = '' }) {
    return this._buildVanDungFallbackWithChatAnalysis({ status, teacherEvaluation, chatHistory, problemText });
  }

  async _rateLimitedGenerate(prompt) {
    this._pending = this._pending.then(async () => {
      try {
        const res = await geminiModelManager.generateContent(prompt);
        await delay(800);
        return res;
      } catch (err) {
        const is429 = err?.status === 429 || String(err?.message || '').includes('429');
        if (is429) {
          await delay(1200);
          try {
            const res2 = await geminiModelManager.generateContent(prompt);
            await delay(800);
            return res2;
          } catch {
            return null;
          }
        }
        return null;
      }
    });

    return this._pending;
  }

  async _generateWithTimeout(prompt, fallbackText, timeoutMs = 3500) {
    try {
      const result = await Promise.race([
        this._rateLimitedGenerate(prompt),
        new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
      ]);

      const responseText = result?.response?.text?.() || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return fallbackText;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return parsed?.student_evaluation || fallbackText;
    } catch {
      return fallbackText;
    }
  }

  async generateKhoiDongEvaluation({ examTitle = 'Bai hoc', correctAnswers = 0, totalQuestions = 0, questionComments = [], questionReviews = [] }) {
    const fallback = this._buildKhoiDongFallback({
      correctAnswers,
      totalQuestions,
      questionReviews
    });

    const compactComments = (questionComments || []).slice(0, 8).map((c) => ({
      questionNum: c?.questionNum,
      comment: c?.comment
    }));

    const compactReviews = (questionReviews || []).slice(0, 8).map((r) => ({
      questionNum: r?.questionNum,
      studentAnswer: r?.studentAnswer,
      result: r?.result,
      comment: r?.comment
    }));

    const weaknessSummary = this._buildKhoiDongWeaknessSummary(compactReviews);

    const prompt = `Bạn là giáo viên Toán lớp 5 rất thân thiện.
Hãy viết NHẬN XÉT RIÊNG CHO HỌC SINH để hiển thị ngay sau khi nộp bài Khởi động.

Dữ liệu:
- Bài học: ${examTitle}
- Số câu đúng: ${correctAnswers}/${totalQuestions}
- Nhận xét từng câu: ${JSON.stringify(compactComments)}
- Dữ liệu từng câu (đáp án học sinh + nhận xét): ${JSON.stringify(compactReviews)}

Tóm tắt điểm yếu kỹ năng để bắt buộc tham chiếu:
${weaknessSummary}

Yêu cầu:
- BẮT BUỘC viết tiếng Việt CÓ DẤU đầy đủ.
- Văn phong dễ thương, động viên, dễ hiểu với học sinh lớp 5.
- Phải có: điểm mạnh, điểm cần cải thiện theo NHÓM KỸ NĂNG (ví dụ: xác định yêu cầu, thực hiện tính toán, kiểm tra lại), lời chúc mừng và khích lệ.
- Bắt buộc dựa trên đáp án + nhận xét từng câu ở trên, không nhận xét chung chung.
- KHÔNG liệt kê danh sách số câu sai.
- Nêu 1-2 điểm yếu chính theo nhóm kỹ năng và đưa gợi ý sửa tương ứng.
- Dài 5-7 câu, không quá 130 chữ.
- Xưng hô: "bạn", "mình". KHÔNG dùng "em".

Trả về JSON:
{
  "student_evaluation": "..."
}`;

    return this._generateWithTimeout(prompt, fallback, 3200);
  }

  async generateLuyenTapEvaluation({ bai1Evaluation = null, bai2Evaluation = null, bai1Status = '', bai2Status = '' }) {
    let fallback = '';
    const b1Done = bai1Status === 'completed';
    const b2Done = bai2Status === 'completed';

    if (b1Done && b2Done) {
      fallback = 'Tuyệt vời! Bạn đã xuất sắc hoàn thành trọn vẹn phần Luyện tập. Mình rất ấn tượng với sự kiên trì và tư duy logic của bạn. Hãy giữ vững phong độ này và luôn nhớ kiểm tra lại các bước tính toán trước khi chốt đáp án cuối cùng nhé. Chúc mừng bạn vì một phần thi cực kỳ hiệu quả!';
    } else if (b1Done || b2Done) {
      fallback = 'Hoan hô tinh thần học tập của bạn! Bạn đã giải quyết thành công một bài Luyện tập và đang thể hiện sự cố gắng rất đáng khen. Bài còn lại có chút thử thách, nhưng đừng lo, cứ chia nhỏ các bước ra và làm từ từ nhé. Mình tin là bạn sẽ sớm hoàn thành trọn vẹn thôi, cố lên!';
    } else {
      fallback = 'Phần Luyện tập hôm nay có vẻ mang đến một chút thử thách cho bạn nhỉ? Không sao cả, điểm mạnh là bạn vẫn đang nỗ lực suy nghĩ và không bỏ cuộc. Hãy thử đọc lại đề bài thật chậm, nháp ra các ý chính trước khi tính toán nhé. Cứ bình tĩnh làm từng bước, mình luôn ở đây để đồng hành cùng bạn!';
    }

    const prompt = `Ban la giao vien Toan lop 5 than thien.
Viet nhan xet chung cho phan Luyen tap danh cho HOC SINH.

Du lieu:
- Trang thai bai1: ${bai1Status}
- Trang thai bai2: ${bai2Status}
- Danh gia bai1: ${JSON.stringify(bai1Evaluation || {})}
- Danh gia bai2: ${JSON.stringify(bai2Evaluation || {})}

Yeu cau:
- Van phong de thuong, khich le hoc sinh lop 5.
- Neu bai chua hoan thanh thi nhac nhe nhang can tiep tuc.
- Neu da hoan thanh thi chi ra diem manh, diem yeu va cach cai thien ngan gon.
- Phai co loi dong vien/chuc mung.
- 5-7 cau, <= 120 chu.
- Xung ho "ban", khong dung "em".

Tra ve JSON:
{
  "student_evaluation": "..."
}`;

    return this._generateWithTimeout(prompt, fallback, 3500);
  }

  async generateLuyenTapBaiEvaluation({ baiNumber = 'bai1', status = '', chatHistory = [], teacherEvaluation = null, problemText = '' }) {
    const fallback = this._buildPracticeFallback({ baiNumber, teacherEvaluation, chatHistory, problemText });

    const compactChat = (chatHistory || [])
      .slice(-10)
      .map((m) => ({
        role: m?.role,
        text: m?.parts?.[0]?.text || m?.text || ''
      }))
      .filter((m) => m.text);

    const compactTeacherEvaluation = teacherEvaluation || {};
    const teacherWeakHints = this._extractPracticeWeakSkillsFromTeacherEvaluation(teacherEvaluation)
      .map((item) => ({
        weakness: item.label,
        hint: item.tip,
        note: item.note
      }));
    const shortProblem = this._safeText(problemText).slice(0, 220);

    const prompt = `Bạn là giáo viên Toán lớp 5 thân thiện.
Viết nhận xét RIÊNG cho học sinh ở ${baiNumber === 'bai1' ? 'Bài 1' : 'Bài 2'} của phần Luyện tập.

Dữ liệu:
- Bài: ${baiNumber}
- Trạng thái: ${status}
- Đề bài luyện tập: ${shortProblem || '(không có)'}
- Lịch sử chat gần đây: ${JSON.stringify(compactChat)}
- Đánh giá 4TC của giáo viên (chỉ để tham khảo nội bộ): ${JSON.stringify(compactTeacherEvaluation)}
- Tóm tắt điểm yếu từ đánh giá giáo viên: ${JSON.stringify(teacherWeakHints)}

Yêu cầu:
- BẮT BUỘC viết tiếng Việt CÓ DẤU đầy đủ.
- Văn phong dễ thương, động viên học sinh lớp 5.
- Nhận xét dựa trên quá trình chat của học sinh (cách đặt câu hỏi, cách sửa sai, cách trình bày).
- Dùng đánh giá 4TC của giáo viên để THAM KHẢO điểm yếu chính.
- Không được nêu trực tiếp TC1/TC2/TC3/TC4 ra phần nhận xét cho học sinh.
- BẮT BUỘC viết khác nhau giữa Bài 1 và Bài 2, tránh lặp lại nguyên văn mẫu câu.
- Nêu ít nhất 2 chi tiết riêng từ dữ liệu của bài hiện tại (đề bài/chat/yếu điểm).
- Chỉ rõ điểm mạnh, điểm cần cải thiện, sai ở đâu (tóm tắt ngắn gọn).
- BẮT BUỘC có 3 ý rõ ràng trong nội dung: "Điểm mạnh:", "Điểm cần cải thiện:", "Lỗi thường gặp:".
- Có câu chúc mừng và khích lệ tinh thần.
- Không nêu số lượt tương tác, số lượt hỏi hay số lượt xin gợi ý.
- Viết ngắn gọn dưới 150 chữ (mục tiêu 110-145 chữ), nội dung rõ ý và cụ thể.
- Nên có 4-6 câu ngắn, dễ đọc với học sinh.
- Xưng hô "bạn", không dùng "em".

Trả về JSON:
{
  "student_evaluation": "..."
}`;

    return this._generateWithTimeout(prompt, fallback, 3200);
  }

  async generateVanDungEvaluation({ status = '', chatHistory = [], teacherEvaluation = null, problemText = '' }) {
    const fallback = this._buildVanDungFallback({
      status,
      teacherEvaluation,
      chatHistory,
      problemText
    });

    const compactChat = (chatHistory || [])
      .slice(-12)
      .map((m) => ({
        role: m?.role,
        text: m?.parts?.[0]?.text || m?.text || ''
      }))
      .filter((m) => m.text);

    const compactTeacherEvaluation = teacherEvaluation || {};
    const teacherWeakHints = this._extractPracticeWeakSkillsFromTeacherEvaluation(teacherEvaluation)
      .map((item) => ({
        weakness: item.label,
        hint: item.tip,
        note: item.note
      }));
    const shortProblem = this._safeText(problemText).slice(0, 220);

    const prompt = `Bạn là giáo viên Toán lớp 5 thân thiện.
Viết nhận xét cho HỌC SINH ở phần Vận dụng.

Dữ liệu:
- Trạng thái: ${status}
- Đề bài vận dụng: ${shortProblem || '(không có)'}
- Lịch sử chat gần đây: ${JSON.stringify(compactChat)}
- Đánh giá 4TC của giáo viên (chỉ để tham khảo nội bộ): ${JSON.stringify(compactTeacherEvaluation)}
- Tóm tắt điểm yếu từ đánh giá giáo viên: ${JSON.stringify(teacherWeakHints)}

Yêu cầu:
- BẮT BUỘC viết tiếng Việt CÓ DẤU đầy đủ.
- Nếu đã completed: nhận xét điểm mạnh, điểm cần cải thiện, động viên.
- Nếu chưa completed: động viên tiếp tục và nhắc cách học tích cực.
- Phải dựa trên quá trình chat của học sinh.
- Dùng đánh giá 4TC của giáo viên để THAM KHẢO điểm yếu chính.
- Không được nêu trực tiếp TC1/TC2/TC3/TC4 ra phần nhận xét cho học sinh.
- Văn phong dễ thương, dễ hiểu cho học sinh lớp 5.
- BẮT BUỘC có cụm "Điểm mạnh:" và "Điểm cần cải thiện:"; nếu có lỗi trong chat thì thêm "Lỗi thường gặp:".
- Viết ngắn gọn dưới 150 chữ (mục tiêu 110-145 chữ), nội dung rõ ý và cụ thể.
- Nên có 4-6 câu ngắn, dễ đọc với học sinh.
- Xưng hô "bạn", không dùng "em".

Trả về JSON:
{
  "student_evaluation": "..."
}`;

    return this._generateWithTimeout(prompt, fallback, 3500);
  }
}

const studentEvaluationServiceInstance = new StudentEvaluationService();
export default studentEvaluationServiceInstance;
