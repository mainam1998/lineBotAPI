import Head from 'next/head';
import { useState, useEffect, useMemo } from 'react';

export default function Home() {
  const [testResults, setTestResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [dashboardWarning, setDashboardWarning] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');

  const runTest = async (endpoint) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/${endpoint}`);
      const data = await response.json();
      setTestResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFiles = async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const response = await fetch('/api/dashboard');
      const data = await response.json();
      if (data.status === 'ok' || data.status === 'warning') {
        setFiles(data.files);

        if (data.status === 'warning') {
          setDashboardWarning(data.message);
        } else {
          setDashboardWarning(null);
        }
      } else {
        setDashboardError(data.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์');
      }
    } catch (err) {
      setDashboardError(err.message);
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
    // ตั้งเวลาดึงข้อมูลใหม่ทุก 1 นาที
    const interval = setInterval(fetchFiles, 60000);
    return () => clearInterval(interval);
  }, []);
  // ฟังก์ชันกำหนดสีตามประเภทไฟล์
  const getTypeColor = (mimeType) => {
    const type = mimeType.split('/')[0];
    const subtype = mimeType.split('/')[1];

    // กำหนดสีตามประเภทหลัก
    switch (type) {
      case 'image':
        return '#4285F4'; // สีน้ำเงิน
      case 'video':
        return '#EA4335'; // สีแดง
      case 'audio':
        return '#FBBC05'; // สีเหลือง
      case 'application':
        // กำหนดสีตามประเภทย่อย
        if (subtype.includes('pdf')) {
          return '#FF5722'; // สีส้มแดง
        } else if (subtype.includes('word') || subtype.includes('document')) {
          return '#4285F4'; // สีน้ำเงิน
        } else if (subtype.includes('sheet') || subtype.includes('excel')) {
          return '#0F9D58'; // สีเขียว
        } else if (subtype.includes('presentation') || subtype.includes('powerpoint')) {
          return '#FF9800'; // สีส้ม
        } else if (subtype.includes('zip') || subtype.includes('compressed')) {
          return '#795548'; // สีน้ำตาล
        }
        return '#607D8B'; // สีเทาสำหรับ application ทั่วไป
      case 'text':
        return '#0F9D58'; // สีเขียว
      default:
        return '#9E9E9E'; // สีเทาสำหรับประเภทที่ไม่รู้จัก
    }
  };

  // ฟังก์ชันสำหรับดึงนามสกุลไฟล์ให้แสดงไม่เกิน 4 ตัวอักษร
  const getFileExtension = (fileName, mimeType) => {
    // ถ้ามีชื่อไฟล์และมีนามสกุล
    if (fileName && fileName.includes('.')) {
      const extension = fileName.split('.').pop();
      // ถ้านามสกุลมีความยาวไม่เกิน 4 ตัวอักษร ให้แสดงทั้งหมด
      if (extension.length <= 4) {
        return extension;
      }
      // ถ้านามสกุลยาวเกิน 4 ตัวอักษร ให้ตัดเหลือ 4 ตัว
      return extension.substring(0, 4);
    }

    // ถ้าไม่มีนามสกุลในชื่อไฟล์ ให้ใช้ MIME type แทน
    const type = mimeType.split('/').pop();
    return type.substring(0, 4);
  };

  // กรองไฟล์ตามคำค้นหาและหมวดหมู่
  const filteredFiles = useMemo(() => {
    if (!searchTerm) return files;

    return files.filter(file => {
      const searchLower = searchTerm.toLowerCase();

      // ค้นหาตามหมวดหมู่ที่เลือก
      if (searchCategory === 'name') {
        return file.name.toLowerCase().includes(searchLower);
      } else if (searchCategory === 'type') {
        return file.mimeType.toLowerCase().includes(searchLower);
      } else if (searchCategory === 'size') {
        return file.size.toLowerCase().includes(searchLower);
      } else if (searchCategory === 'date') {
        return file.createdTime.toLowerCase().includes(searchLower);
      } else {
        // ค้นหาทุกหมวดหมู่
        return (
          file.name.toLowerCase().includes(searchLower) ||
          file.mimeType.toLowerCase().includes(searchLower) ||
          file.size.toLowerCase().includes(searchLower) ||
          file.createdTime.toLowerCase().includes(searchLower)
        );
      }
    });
  }, [files, searchTerm, searchCategory]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      minHeight: '100vh',
      padding: '2rem',
      textAlign: 'center',
      backgroundColor: '#020126',
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif'
    }}>
      <Head>
        <title>LINE File Bot</title>
        <meta name="description" content="LINE Bot for uploading files to Google Drive" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main style={{ width: '100%', maxWidth: '1200px' }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h1 style={{
            fontSize: '2.5rem',
            marginBottom: '1rem',
            color: '#4630D9', // สีม่วงตามโทนที่กำหนด
            fontWeight: '700'
          }}>
            LINE File Bot
          </h1>
          <p style={{
            fontSize: '1.25rem',
            marginBottom: '1rem',
            color: '#fff',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            บอทรับไฟล์จาก LINE และอัพโหลดไปยัง Google Drive โดยอัตโนมัติ
          </p>
        </div>
        <div style={{
          padding: '1.5rem',
          border: '1px solid #150259',
          borderRadius: '10px',
          backgroundColor: '#0A0140',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            marginBottom: '1rem',
            color: '#fff',
            fontWeight: '600'
          }}>สถานะระบบ</h2>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ textAlign: 'left' }}>
              <p style={{ color: '#fff' }}>
                Webhook URL: <code style={{ backgroundColor: '#150259', padding: '0.2rem 0.4rem', borderRadius: '4px', color: '#fff' }}>/api/callback</code>
              </p>
              <p style={{ marginTop: '0.5rem', color: '#4630D9', fontWeight: '500' }}>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#4630D9', marginRight: '8px' }}></span>
                บอทพร้อมรับข้อความแล้ว
              </p>
            </div>
            <div>
              <button
                onClick={() => fetchFiles()}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#4630D9',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>&#x21bb;</span> รีเฟรชข้อมูล
              </button>
            </div>
          </div>
        </div>

        <div style={{
          padding: '1.5rem',
          border: '1px solid #150259',
          borderRadius: '10px',
          backgroundColor: '#0A0140',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#fff', fontWeight: '600' }}>รายการไฟล์ที่อัพโหลด</h2>
          </div>

          {/* ช่องค้นหา */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <div style={{
              flex: '1',
              minWidth: '250px',
              position: 'relative'
            }}>
              <input
                type="text"
                placeholder="ค้นหาไฟล์..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 15px',
                  border: '1px solid #150259',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                  backgroundColor: '#020126',
                  color: '#fff'
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    color: '#4630D9'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
            <select
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
              style={{
                padding: '10px 15px',
                border: '1px solid #150259',
                borderRadius: '4px',
                backgroundColor: '#020126',
                color: '#fff',
                fontSize: '1rem',
                outline: 'none'
              }}
            >
              <option value="all">ทั้งหมด</option>
              <option value="name">ชื่อไฟล์</option>
              <option value="type">ประเภท</option>
              <option value="size">ขนาด</option>
              <option value="date">วันที่อัพโหลด</option>
            </select>
          </div>

          {dashboardLoading && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              backgroundColor: '#150259',
              borderRadius: '8px',
              margin: '20px 0'
            }}>
              <div style={{
                display: 'inline-block',
                width: '40px',
                height: '40px',
                border: '4px solid rgba(0, 185, 0, 0.1)',
                borderTopColor: '#00B900',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '10px'
              }} />
              <p style={{ color: '#fff', marginTop: '10px' }}>กำลังโหลดข้อมูล...</p>
              <style jsx>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          )}

          {dashboardError && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#FFEBEE',
              color: '#D32F2F',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{ fontSize: '24px' }}>⚠️</div>
              <div>
                <p style={{ margin: 0, fontWeight: '500' }}>ข้อผิดพลาด</p>
                <p style={{ margin: '4px 0 0 0' }}>{dashboardError}</p>
              </div>
            </div>
          )}

          {dashboardWarning && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#FFF8E1',
              color: '#F57F17',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{ fontSize: '24px' }}>ℹ️</div>
              <div>
                <p style={{ margin: 0, fontWeight: '500' }}>คำเตือน</p>
                <p style={{ margin: '4px 0 0 0' }}>{dashboardWarning}</p>
              </div>
            </div>
          )}

          {!dashboardLoading && !dashboardError && files.length === 0 && (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: '#150259',
              borderRadius: '8px',
              margin: '20px 0',
              border: '1px dashed #4630D9'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '15px', color: '#4630D9' }}>
                📁
              </div>
              <p style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>ไม่พบไฟล์ในโฟลเดอร์</p>
              <p style={{ fontSize: '0.9rem', color: '#4630D9', marginTop: '10px' }}>
                ส่งไฟล์ผ่าน LINE เพื่ออัพโหลดไปยัง Google Drive
              </p>
            </div>
          )}

          {!dashboardLoading && !dashboardError && files.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <div style={{
                maxHeight: '500px',
                overflowY: 'auto',
                border: '1px solid #150259',
                borderRadius: '8px',
                backgroundColor: '#0A0140'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#150259', zIndex: 1 }}>
                    <tr style={{ borderBottom: '2px solid #4630D9' }}>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>ชื่อไฟล์</th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>ประเภท</th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>ขนาด</th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>วันที่อัพโหลด</th>
                      <th style={{ padding: '14px 12px', textAlign: 'left', color: '#fff', fontWeight: '600' }}>ลิงก์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFiles.length > 0 ? (
                      filteredFiles.map((file) => (
                        <tr key={file.id} style={{ borderBottom: '1px solid #150259', transition: 'background-color 0.2s' }}>
                          <td style={{ padding: '12px', color: '#fff' }}>{file.name}</td>
                          <td style={{ padding: '12px', color: '#fff' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              backgroundColor: getTypeColor(file.mimeType),
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '0.85rem'
                            }}>
                              {getFileExtension(file.name, file.mimeType)}
                            </span>
                          </td>
                          <td style={{ padding: '12px', color: '#fff' }}>{file.size}</td>
                          <td style={{ padding: '12px', color: '#fff' }}>{file.createdTime}</td>
                          <td style={{ padding: '12px' }}>
                            {file.webViewLink ? (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: '#4630D9',
                                  textDecoration: 'none',
                                  padding: '6px 12px',
                                  backgroundColor: '#150259',
                                  border: '1px solid #4630D9',
                                  borderRadius: '4px',
                                  display: 'inline-block',
                                  fontSize: '0.9rem',
                                  fontWeight: '500',
                                  transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => {
                                  e.target.style.backgroundColor = '#4630D9';
                                  e.target.style.color = 'white';
                                }}
                                onMouseOut={(e) => {
                                  e.target.style.backgroundColor = '#150259';
                                  e.target.style.color = '#4630D9';
                                }}
                              >
                                เปิดไฟล์
                              </a>
                            ) : (
                              <span style={{ color: '#4630D9', fontSize: '0.9rem' }}>ไม่มีลิงก์</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#fff' }}>
                          ไม่พบไฟล์ที่ตรงกับคำค้นหา
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{
                marginTop: '15px',
                fontSize: '0.9rem',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>
                  {searchTerm ?
                    `พบ ${filteredFiles.length} รายการ จากทั้งหมด ${files.length} รายการ` :
                    `แสดงรายการทั้งหมด ${files.length} รายการ`
                  }
                </span>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4630D9',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      padding: '4px 8px'
                    }}
                  >
                    ล้างการค้นหา
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '1.5rem',
          border: '1px solid #150259',
          borderRadius: '10px',
          backgroundColor: '#0A0140',
          marginBottom: '2rem',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            marginBottom: '1.5rem',
            color: '#fff',
            fontWeight: '600'
          }}>เครื่องมือทดสอบระบบ</h2>

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            marginBottom: '1.5rem',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => runTest('test')}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: '#150259',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#4630D9'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#150259'}
            >
              <span>⚙️</span> ทดสอบ API
            </button>

            <button
              onClick={() => runTest('line-test')}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: '#150259',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#4630D9'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#150259'}
            >
              <span>💬</span> ทดสอบ LINE API
            </button>

            <button
              onClick={() => runTest('drive-test')}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: '#150259',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#4630D9'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#150259'}
            >
              <span>📂</span> ทดสอบ Google Drive API
            </button>
          </div>

          {isLoading && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              backgroundColor: '#150259',
              borderRadius: '8px',
              margin: '20px 0'
            }}>
              <div style={{
                display: 'inline-block',
                width: '30px',
                height: '30px',
                border: '3px solid rgba(0, 0, 0, 0.1)',
                borderTopColor: '#666',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '10px'
              }} />
              <p style={{ color: '#fff', marginTop: '10px' }}>กำลังทดสอบ...</p>
            </div>
          )}

          {error && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#FFEBEE',
              color: '#D32F2F',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{ fontSize: '24px', marginTop: '2px' }}>⚠️</div>
              <div>
                <p style={{ margin: 0, fontWeight: '500' }}>ข้อผิดพลาด</p>
                <p style={{ margin: '4px 0 0 0' }}>{error}</p>
              </div>
            </div>
          )}

          {testResults && (
            <div style={{
              padding: '1.5rem',
              backgroundColor: testResults.status === 'ok' ? '#f0fff0' : '#FFF8E1',
              color: testResults.status === 'ok' ? '#2E7D32' : '#F57F17',
              borderRadius: '8px',
              textAlign: 'left',
              maxHeight: '400px',
              overflowY: 'auto',
              border: `1px solid ${testResults.status === 'ok' ? '#C8E6C9' : '#FFE0B2'}`,
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '15px',
                padding: '0 0 15px 0',
                borderBottom: `1px solid ${testResults.status === 'ok' ? '#C8E6C9' : '#FFE0B2'}`
              }}>
                <div style={{ fontSize: '24px' }}>
                  {testResults.status === 'ok' ? '✅' : '⚠️'}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '1.1rem' }}>
                    สถานะ: {testResults.status === 'ok' ? 'สำเร็จ' : 'ไม่สำเร็จ'}
                  </p>
                  <p style={{ margin: '4px 0 0 0', color: testResults.status === 'ok' ? '#388E3C' : '#E65100' }}>
                    {testResults.message}
                  </p>
                </div>
              </div>

              {testResults.env && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>ตัวแปรสภาพแวดล้อม:</p>
                  <div style={{
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    padding: '10px 15px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0,0,0,0.05)'
                  }}>
                    <ul style={{ margin: '0', paddingLeft: '20px' }}>
                      {Object.entries(testResults.env).map(([key, value]) => (
                        <li key={key} style={{ margin: '6px 0' }}>
                          <span style={{ fontWeight: '500' }}>{key}:</span> {String(value)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {testResults.botInfo && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>ข้อมูลบอท:</p>
                  <div style={{
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    padding: '10px 15px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0,0,0,0.05)'
                  }}>
                    <pre style={{
                      whiteSpace: 'pre-wrap',
                      margin: 0,
                      fontFamily: 'monospace',
                      fontSize: '0.9rem'
                    }}>
                      {JSON.stringify(testResults.botInfo, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {testResults.files && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>ไฟล์:</p>
                  <div style={{
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    padding: '10px 15px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0,0,0,0.05)'
                  }}>
                    <pre style={{
                      whiteSpace: 'pre-wrap',
                      margin: 0,
                      fontFamily: 'monospace',
                      fontSize: '0.9rem'
                    }}>
                      {JSON.stringify(testResults.files, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {testResults.error && (
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontWeight: '600', marginBottom: '8px', color: '#D32F2F' }}>รายละเอียดข้อผิดพลาด:</p>
                  <div style={{
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    padding: '10px 15px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0,0,0,0.05)'
                  }}>
                    <p style={{ margin: '0', color: '#D32F2F' }}>{testResults.error}</p>
                    {testResults.privateKeyHint && (
                      <p style={{ margin: '10px 0 0 0', fontWeight: '500' }}>
                        <strong>คำแนะนำ:</strong> {testResults.privateKeyHint}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
