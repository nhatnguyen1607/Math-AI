import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import * as worksheetResultService from '../../services/student/worksheetResultService';
import * as worksheetService from '../../services/faculty/worksheetService';
import classService from '../../services/faculty/classService';
import FacultyHeader from '../../components/faculty/FacultyHeader';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

const FacultyWorksheetResultListPage = ({ user, onSignOut }) => {
  const navigate = useNavigate();
  const { worksheetId } = useParams();
  const location = useLocation();
  const classId = location.state?.classId;
  const [loading, setLoading] = useState(true);
  const [worksheet, setWorksheet] = useState(null);
  const [results, setResults] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [className, setClassName] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('xlsx');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load worksheet info
        const worksheetData = await worksheetService.getWorksheetById(worksheetId, classId);
        setWorksheet(worksheetData);

        // Load class name
        if (classId) {
          try {
            const classData = await classService.getClassById(classId);
            setClassName(classData?.name || 'Class');
          } catch (error) {
            console.log('Could not load class name');
            setClassName('Class');
          }
        }

        // Load all results for this worksheet
        const resultsData = await worksheetResultService.getWorksheetResultsByWorksheet(worksheetId, classId);
        
        // Sort by studentName alphabetically
        const sorted = (resultsData || []).sort((a, b) => 
          (a.studentName || '').localeCompare(b.studentName || '', 'vi')
        );
        
        setResults(sorted);
      } catch (error) {
        console.error('Error loading data:', error);
        alert('Lỗi khi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [worksheetId, classId]);

  // Function to capitalize level names
  const capitalizeLevelName = (level) => {
    if (!level) return 'Chưa đánh giá';
    const lower = level.toLowerCase().trim();
    if (lower === 'tốt') return 'Tốt';
    if (lower === 'đạt') return 'Đạt';
    if (lower === 'cần cố gắng') return 'Cần cố gắng';
    return level;
  };

  // Function to format detail data
  const getDetailData = (result) => {
    const detailData = [
      ['Phiếu bài tập', worksheet?.name || 'N/A'],
      ['Tên học sinh', result.studentName || 'N/A'],
      ['Lớp', className],
      ['Ngày nộp', result.submittedAt?.toDate?.()?.toLocaleDateString?.('vi-VN') || 'N/A'],
      [''],
      ['Tổng điểm', (result.tongDiem || 0) + '/8'],
      ['Mức năng lực chung', capitalizeLevelName(result.mucNangLucChung) || 'Chưa đánh giá'],
      ['Nhận xét chung', result.nhanXetChung || ''],
      [''],
    ];

    // Bài 1 - Tiêu chí 1
    if (result.bai_1) {
      detailData.push(['BÀI 1: CHỌN ĐÁP ÁN ĐÚNG']);
      if (result.bai_1.selections) {
        let selections = result.bai_1.selections;
        if (typeof selections === 'object' && !Array.isArray(selections)) {
          selections = Object.values(selections);
        }
        if (Array.isArray(selections)) {
          const selectedAnswers = selections
            .map(qId => {
              const question = worksheet?.bai_1?.questions?.find(q => q.id === qId);
              return question?.text || qId;
            })
            .join('; ');
          detailData.push(['Đã chọn:', selectedAnswers || 'Không có đáp án']);
        }
      }
      detailData.push(['Tiêu chí 1: Nhận biết được vấn đề', '']);
      detailData.push(['  Điểm', result.bai_1?.evaluation?.diem || 0]);
      detailData.push(['  Mức năng lực', capitalizeLevelName(result.bai_1?.evaluation?.muc_nang_luc) || 'N/A']);
      detailData.push(['  Nhận xét', result.bai_1?.evaluation?.nhan_xet || 'N/A']);
      detailData.push(['']);
    }

    // Bài 2 - Tiêu chí 2
    if (result.bai_2) {
      detailData.push(['BÀI 2: SẮP XẾP CÁC BƯỚC']);
      if (result.bai_2.arrangements) {
        const sortedCaches = Object.keys(result.bai_2.arrangements)
          .sort((a, b) => {
            const numA = parseInt(a.replace('cach_', ''));
            const numB = parseInt(b.replace('cach_', ''));
            return numA - numB;
          });

        for (const cachKey of sortedCaches) {
          const cachNum = cachKey.replace('cach_', '');
          let arrangements = result.bai_2.arrangements[cachKey] || [];
          if (typeof arrangements === 'object' && !Array.isArray(arrangements)) {
            arrangements = Object.values(arrangements);
          }
          const arrangementText = Array.isArray(arrangements)
            ? arrangements
                .map((qId, idx) => {
                  const question = worksheet?.bai_2?.questions?.find(q => q.id === qId);
                  return `${idx + 1}. ${question?.text || qId}`;
                })
                .join('\n')
            : (arrangements || 'Không có');
          detailData.push([`Cách ${cachNum}:`, arrangementText || 'Không có']);
        }
      }
      detailData.push(['Tiêu chí 2: Nêu được cách thức giải quyết vấn đề', '']);
      detailData.push(['  Điểm', result.bai_2?.evaluation?.diem || 0]);
      detailData.push(['  Mức năng lực', capitalizeLevelName(result.bai_2?.evaluation?.muc_nang_luc) || 'N/A']);
      detailData.push(['  Nhận xét', result.bai_2?.evaluation?.nhan_xet || 'N/A']);
      detailData.push(['']);
    }

    // Bài 3 - Tiêu chí 3
    if (result.bai_3) {
      detailData.push(['BÀI 3: TỰ LUẬN']);
      detailData.push(['Bài làm', result.bai_3.bai_lam || '(không có)']);
      detailData.push(['Giải thích', result.bai_3.giai_thich || '(không có)']);
      detailData.push(['Tiêu chí 3: Trình bày được cách thức giải quyết vấn đề', '']);
      detailData.push(['  Điểm', result.bai_3?.evaluation?.diem || 0]);
      detailData.push(['  Mức năng lực', capitalizeLevelName(result.bai_3?.evaluation?.muc_nang_luc) || 'N/A']);
      detailData.push(['  Nhận xét', result.bai_3?.evaluation?.nhan_xet || 'N/A']);
      detailData.push(['']);
    }

    // Bài 4
    if (result.bai_4) {
      detailData.push(['BÀI 4: BÀI TẬP NÂNG CAO']);
      if (result.bai_4.answers && typeof result.bai_4.answers === 'object') {
        for (const [qId, answer] of Object.entries(result.bai_4.answers)) {
          const question = worksheet?.bai_4?.questions?.find(q => q.id === qId);
          const questionLabel = question?.label ? `${question.label}` : `Câu ${qId}`;
          
          detailData.push([`${questionLabel}: ${question?.text || ''}`, '']);
          
          if (question?.type === 'cau_hoi_nho' && question?.subQuestions) {
            let answerArray = answer;
            if (typeof answer === 'object' && !Array.isArray(answer)) {
              answerArray = Object.values(answer);
            }
            question.subQuestions.forEach((subQ, idx) => {
              const ansText = Array.isArray(answerArray) ? answerArray[idx] : '';
              detailData.push([`  Câu ${idx + 1}: ${subQ.text}`, ansText || '(không có)']);
            });
          } else if (question?.type === 'so_cach_giai') {
            let answerArray = answer;
            if (typeof answer === 'object' && !Array.isArray(answer)) {
              answerArray = Object.values(answer);
            }
            const numCaches = parseInt(question?.content) || 0;
            for (let i = 0; i < numCaches; i++) {
              const ansText = Array.isArray(answerArray) ? answerArray[i] : '';
              detailData.push([`  Cách ${i + 1}:`, ansText || '(không có)']);
            }
          } else {
            const ansText = typeof answer === 'object' && !Array.isArray(answer) 
              ? Object.values(answer)[0] || ''
              : answer;
            detailData.push(['', ansText || '(không có)']);
          }
        }
      }
      detailData.push(['Tiêu chí 4: Kiểm tra và vận dụng giải pháp', '']);
      detailData.push(['  Điểm', result.bai_4?.evaluation?.diem || 0]);
      detailData.push(['  Mức năng lực', capitalizeLevelName(result.bai_4?.evaluation?.muc_nang_luc) || 'N/A']);
      detailData.push(['  Nhận xét', result.bai_4?.evaluation?.nhan_xet || 'N/A']);
      detailData.push(['']);
    }

    return detailData;
  };

  // Export to Excel
  const exportToExcel = async (zip) => {
    for (const result of results) {
      const workbook = XLSX.utils.book_new();
      const detailData = getDetailData(result);

      const ws = XLSX.utils.aoa_to_sheet(detailData);
      ws['!cols'] = [{ wch: 40 }, { wch: 80 }];
      
      const calculateRowHeight = (text, maxWidth) => {
        if (!text) return 20;
        const textLength = String(text).length;
        const estimatedLines = Math.ceil(textLength / maxWidth);
        return Math.max(20, Math.min(estimatedLines * 15, 200));
      };
      
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        if (!ws['!rows']) ws['!rows'] = [];
        let maxHeight = 20;
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_col(C) + XLSX.utils.encode_row(R);
          const cell = ws[cellAddress];
          if (cell) {
            const colWidth = C === 0 ? 40 : 80;
            const height = calculateRowHeight(cell.v, colWidth);
            maxHeight = Math.max(maxHeight, height);
            cell.alignment = {
              wrapText: true,
              vertical: 'top',
              horizontal: 'left'
            };
          }
        }
        ws['!rows'][R] = { hpt: maxHeight, hidden: false };
      }
      
      XLSX.utils.book_append_sheet(workbook, ws, 'Kết quả');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const fileName = `${result.studentName || 'Student'}.xlsx`;
      zip.file(fileName, excelBuffer);
    }
  };

  // Export to TXT
  const exportToTxt = async (zip) => {
    for (const result of results) {
      const detailData = getDetailData(result);
      const txtContent = detailData
        .map(row => row.join('\t'))
        .join('\n');
      
      const fileName = `${result.studentName || 'Student'}.txt`;
      zip.file(fileName, txtContent);
    }
  };

  // Export to PDF
  // Export to PDF with proper Vietnamese font support
  const exportToPdf = async (zip) => {
    const html2pdf = (await import('html2pdf.js')).default;
    
    const createPdf = (result) => {
      return new Promise((resolve) => {
        const detailData = getDetailData(result);
        
        // Generate HTML content
        let htmlContent = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; line-height: 1.5; padding: 15px; color: #333; width: 100%; background: white;">
            <h2 style="text-align: center; margin: 0 0 20px 0; font-size: 14px; border-bottom: 2px solid #000; padding-bottom: 10px;">
              ${worksheet?.name || 'Kết quả bài tập'}
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        `;
        
        // Add rows to table
        for (const row of detailData) {
          const [label, value] = row;
          const valueHtml = String(value ?? '').replace(/\n/g, '<br/>');
          
          if (label === '' && value === '') {
            htmlContent += '<tr><td colspan="2" style="height: 8px;"></td></tr>';
          } else if (label.startsWith('BÀI')) {
            htmlContent += `
              <tr style="background-color: #e8e8e8;">
                <td colspan="2" style="padding: 10px 8px; font-weight: bold; border: 1px solid #999; font-size: 12px;">
                  ${label}
                </td>
              </tr>
            `;
          } else {
            htmlContent += `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: 600; width: 35%; vertical-align: top; background-color: #f9f9f9;">
                  ${label}
                </td>
                <td style="padding: 8px; border: 1px solid #ddd; vertical-align: top;">
                  ${valueHtml}
                </td>
              </tr>
            `;
          }
        }
        
        htmlContent += `
            </table>
          </div>
        `;
        
        // Create temporary container with visible dimensions
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '210mm';
        container.style.height = '297mm';
        container.style.padding = '0';
        container.style.margin = '0';
        container.style.backgroundColor = 'white';
        container.style.overflow = 'hidden';
        container.style.zIndex = '-1000';
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
        
        // Create element
        const element = document.createElement('div');
        element.innerHTML = htmlContent;
        element.style.width = '100%';
        element.style.padding = '10mm';
        element.style.boxSizing = 'border-box';
        
        container.appendChild(element);
        document.body.appendChild(container);
        
        // Wait for rendering
        setTimeout(() => {
          const options = {
            margin: [5, 5, 5, 5],
            filename: `${result.studentName || 'Student'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
              scale: 2, 
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff'
            },
            jsPDF: { 
              orientation: 'portrait', 
              unit: 'mm', 
              format: 'a4',
              compress: true
            }
          };
          
          // Generate PDF
          html2pdf()
            .set(options)
            .from(element)
            .toPdf()
            .get('pdf')
            .then((pdf) => {
              const pdfBlob = pdf.output('blob');
              zip.file(`${result.studentName || 'Student'}.pdf`, pdfBlob);
              document.body.removeChild(container);
              resolve();
            })
            .catch((err) => {
              console.error('PDF generation error:', err);
              document.body.removeChild(container);
              resolve();
            });
        }, 100);
      });
    };
    
    // Process results sequentially
    for (const result of results) {
      await createPdf(result);
    }
  };

  // Export all data as simple Excel
  const exportAllSimple = async () => {
    try {
      setExporting(true);
      const workbook = XLSX.utils.book_new();
      const exportData = [
        ['STT', 'Tên học sinh', 'Điểm']
      ];
      
      results.forEach((result, idx) => {
        exportData.push([
          idx + 1,
          result.studentName || 'N/A',
          result.tongDiem || 0
        ]);
      });
      
      const ws = XLSX.utils.aoa_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 30 },
        { wch: 12 }
      ];
      
      XLSX.utils.book_append_sheet(workbook, ws, 'Kết quả');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      
      const url = window.URL.createObjectURL(new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${worksheet?.name || 'Kết quả'}.xlsx`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert('Xuất dữ liệu thành công!');
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Lỗi khi xuất dữ liệu: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  // Main export handler
  const handleExportData = async () => {
    try {
      setExporting(true);
      const zip = new JSZip();

      if (exportFormat === 'xlsx') {
        await exportToExcel(zip);
      } else if (exportFormat === 'txt') {
        await exportToTxt(zip);
      } else if (exportFormat === 'pdf') {
        await exportToPdf(zip);
      }

      // Generate zip file and download
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      
      // Use worksheet type to determine filename prefix
      const filePrefix = worksheet?.type === 'input' ? 'phieudauvao' : 'phiếu đầu ra';
      const extension = exportFormat === 'xlsx' ? 'zip' : 'zip'; // Always ZIP since it contains multiple files
      link.setAttribute('download', `${filePrefix}_${className}.${extension}`);
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert('Xuất dữ liệu thành công!');
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Lỗi khi xuất dữ liệu: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">⏳</div>
          <p className="text-2xl font-bold text-gray-700">Đang tải kết quả...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100">
      <FacultyHeader user={user} onLogout={onSignOut} navItems={[]} />

      <div className="px-8 py-8 max-w-7xl mx-auto">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => navigate(`/faculty/worksheet/management`)}
            className="px-4 py-2 bg-white hover:bg-gray-100 rounded-full font-semibold text-gray-700 transition-all shadow-md hover:shadow-lg"
          >
            ← Quay lại
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            disabled={results.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-full transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span className="text-lg">📥</span>
            Xuất dữ liệu
          </button>
          <button
            onClick={exportAllSimple}
            disabled={results.length === 0 || exporting}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold rounded-full transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <span className="text-lg">📊</span>
            Xuất toàn bộ
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">📊</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">{worksheet?.name}</h1>
          <p className="text-xl text-gray-600">
            {results.length} học sinh đã nộp bài
          </p>
        </div>

        {/* Results Table */}
        {results.length > 0 ? (
          <div className="bg-white rounded-3xl shadow-lg border-4 border-blue-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                    <th className="px-6 py-4 text-left font-bold">STT</th>
                    <th className="px-6 py-4 text-left font-bold">Tên học sinh</th>
                    <th className="px-6 py-4 text-center font-bold">Điểm</th>
                    <th className="px-6 py-4 text-center font-bold">Mức năng lực</th>
                    <th className="px-6 py-4 text-center font-bold">Ngày nộp</th>
                    <th className="px-6 py-4 text-center font-bold">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {results.map((result, idx) => (
                    <tr key={result.id} className="hover:bg-blue-50 transition-all">
                      <td className="px-6 py-4 font-semibold text-gray-700">{idx + 1}</td>
                      <td className="px-6 py-4 font-semibold text-gray-800">{result.studentName}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full font-bold text-lg">
                          {result.tongDiem || 0}/8
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-4 py-2 rounded-full font-bold text-white ${
                          result.mucNangLucChung === 'tốt' || result.mucNangLucChung === 'Tốt' ? 'bg-green-500' :
                          result.mucNangLucChung === 'đạt' || result.mucNangLucChung === 'Đạt' ? 'bg-blue-500' :
                          result.mucNangLucChung === 'cần cố gắng' || result.mucNangLucChung === 'Cần cố gắng' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`}>
                          {result.mucNangLucChung ? (result.mucNangLucChung.charAt(0).toUpperCase() + result.mucNangLucChung.slice(1)) : 'Chưa đánh giá'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-600">
                        {result.submittedAt?.toDate?.()?.toLocaleDateString?.('vi-VN') || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => navigate(
                            `/faculty/worksheet/${worksheetId}/result/${result.studentId}`,
                            { state: { result, classId } }
                          )}
                          className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-md"
                        >
                          👀 Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-2xl font-bold text-gray-700">Chưa có học sinh nộp bài</p>
          </div>
        )}

        {/* Export Format Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Chọn định dạng xuất</h2>
              
              <div className="space-y-3 mb-8">
                <label className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 cursor-pointer transition-all"
                  style={{ borderColor: exportFormat === 'xlsx' ? '#3b82f6' : '', backgroundColor: exportFormat === 'xlsx' ? '#eff6ff' : '' }}>
                  <input
                    type="radio"
                    name="format"
                    value="xlsx"
                    checked={exportFormat === 'xlsx'}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="w-5 h-5 text-blue-600 cursor-pointer"
                  />
                  <span className="ml-3 text-lg font-semibold text-gray-800">📊 Excel (.xlsx)</span>
                </label>
                
                <label className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-purple-500 cursor-pointer transition-all"
                  style={{ borderColor: exportFormat === 'txt' ? '#a855f7' : '', backgroundColor: exportFormat === 'txt' ? '#faf5ff' : '' }}>
                  <input
                    type="radio"
                    name="format"
                    value="txt"
                    checked={exportFormat === 'txt'}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="w-5 h-5 text-purple-600 cursor-pointer"
                  />
                  <span className="ml-3 text-lg font-semibold text-gray-800">📝 Text (.txt)</span>
                </label>
                
                <label className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-red-500 cursor-pointer transition-all"
                  style={{ borderColor: exportFormat === 'pdf' ? '#ef4444' : '', backgroundColor: exportFormat === 'pdf' ? '#fef2f2' : '' }}>
                  <input
                    type="radio"
                    name="format"
                    value="pdf"
                    checked={exportFormat === 'pdf'}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="w-5 h-5 text-red-600 cursor-pointer"
                  />
                  <span className="ml-3 text-lg font-semibold text-gray-800">📄 PDF (.pdf)</span>
                </label>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handleExportData}
                  disabled={exporting}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span>{exporting ? '⏳' : '📥'}</span>
                  {exporting ? 'Đang xuất...' : 'Xuất'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyWorksheetResultListPage;
