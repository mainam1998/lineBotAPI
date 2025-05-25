import Head from 'next/head';
import { useState, useEffect, useMemo } from 'react';
import styles from '../styles/Home.module.css';

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
    <>
      <Head>
        <title>LINE File Bot</title>
        <meta name="description" content="LINE Bot for uploading files to Google Drive" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.container}>
        <main className={styles.main}>
          {/* Header Section */}
          <div className={styles.header}>
            <h1 className={styles.title}>LINE File Bot</h1>
            <p className={styles.subtitle}>
              บอทรับไฟล์จาก LINE และอัพโหลดไปยัง Google Drive โดยอัตโนมัติ
            </p>
          </div>

          {/* System Status Card */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>สถานะระบบ</h2>
            <div className={styles.statusContent}>
              <div className={styles.statusInfo}>
                <p>
                  Webhook URL: <code>/api/callback</code>
                </p>
                <p className={styles.statusIndicator}>
                  <span className={styles.statusDot}></span>
                  บอทพร้อมรับข้อความแล้ว
                </p>
              </div>
              <div>
                <button
                  className={styles.refreshButton}
                  onClick={() => fetchFiles()}
                >
                  🔄 รีเฟรช
                </button>
              </div>
            </div>
          </div>

          {/* Files List Card */}
          <div className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className={styles.cardTitle}>รายการไฟล์ที่อัพโหลด</h2>
            </div>

            {/* Search Section */}
            <div className={styles.searchContainer}>
              <div className={styles.searchInput}>
                <input
                  type="text"
                  placeholder="ค้นหาไฟล์..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    className={styles.clearButton}
                    onClick={() => setSearchTerm('')}
                  >
                    ✕
                  </button>
                )}
              </div>
              <select
                className={styles.searchSelect}
                value={searchCategory}
                onChange={(e) => setSearchCategory(e.target.value)}
              >
                <option value="all">ทั้งหมด</option>
                <option value="name">ชื่อไฟล์</option>
                <option value="type">ประเภท</option>
                <option value="size">ขนาด</option>
                <option value="date">วันที่อัพโหลด</option>
              </select>
            </div>

            {/* Loading State */}
            {dashboardLoading && (
              <div className={styles.loading}>
                <div className={styles.loadingSpinner}></div>
                <p className={styles.loadingText}>กำลังโหลดข้อมูล...</p>
              </div>
            )}

            {/* Error State */}
            {dashboardError && (
              <div className={`${styles.alert} ${styles.alertError}`}>
                <span className={styles.alertIcon}>⚠️</span>
                <div className={styles.alertContent}>
                  <h4>เกิดข้อผิดพลาด</h4>
                  <p>{dashboardError}</p>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!dashboardLoading && !dashboardError && files.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📁</div>
                <p className={styles.emptyTitle}>ไม่พบไฟล์ในโฟลเดอร์</p>
                <p className={styles.emptySubtitle}>
                  ส่งไฟล์ผ่าน LINE เพื่ออัพโหลดไปยัง Google Drive
                </p>
              </div>
            )}

            {/* Files Table */}
            {!dashboardLoading && !dashboardError && files.length > 0 && (
              <div className={styles.tableWrapper}>
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead className={styles.tableHeader}>
                      <tr>
                        <th className={styles.tableHeaderCell}>ชื่อไฟล์</th>
                        <th className={styles.tableHeaderCell}>ประเภท</th>
                        <th className={styles.tableHeaderCell}>ขนาด</th>
                        <th className={styles.tableHeaderCell}>วันที่อัพโหลด</th>
                        <th className={styles.tableHeaderCell}>ลิงก์</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFiles.length > 0 ? (
                        filteredFiles.map((file) => (
                          <tr key={file.id} className={styles.tableRow}>
                            <td className={styles.tableCell}>{file.name}</td>
                            <td className={styles.tableCell}>
                              <span
                                className={styles.fileTypeTag}
                                style={{ backgroundColor: getTypeColor(file.mimeType) }}
                              >
                                {getFileExtension(file.name, file.mimeType)}
                              </span>
                            </td>
                            <td className={styles.tableCell}>{file.size}</td>
                            <td className={styles.tableCell}>{file.createdTime}</td>
                            <td className={styles.tableCell}>
                              {file.webViewLink ? (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.fileLink}
                                >
                                  เปิดไฟล์
                                </a>
                              ) : (
                                <span className={styles.noLink}>ไม่มีลิงก์</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className={styles.emptyRow}>
                            ไม่พบไฟล์ที่ตรงกับคำค้นหา
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={styles.stats}>
                  <span>แสดง {filteredFiles.length} จาก {files.length} ไฟล์</span>
                  {searchTerm && (
                    <button
                      className={styles.clearSearchButton}
                      onClick={() => setSearchTerm('')}
                    >
                      ล้างการค้นหา
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* System Testing Card */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>เครื่องมือทดสอบระบบ</h2>

            <div className={styles.buttonGroup}>
              <button
                className={styles.button}
                onClick={() => runTest('test')}
              >
                <span>⚙️</span> ทดสอบ API
              </button>

              <button
                className={styles.button}
                onClick={() => runTest('line-test')}
              >
                <span>💬</span> ทดสอบ LINE API
              </button>

              <button
                className={styles.button}
                onClick={() => runTest('drive-test')}
              >
                <span>📂</span> ทดสอบ Google Drive API
              </button>
            </div>

            {/* Testing Loading State */}
            {isLoading && (
              <div className={styles.loading}>
                <div className={styles.loadingSpinner}></div>
                <p className={styles.loadingText}>กำลังทดสอบ...</p>
              </div>
            )}

            {/* Testing Error State */}
            {error && (
              <div className={`${styles.alert} ${styles.alertError}`}>
                <span className={styles.alertIcon}>❌</span>
                <div className={styles.alertContent}>
                  <h4>การทดสอบล้มเหลว</h4>
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* Testing Results */}
            {testResults && (
              <div className={`${styles.alert} ${testResults.success ? styles.alertSuccess : styles.alertWarning}`}>
                <span className={styles.alertIcon}>{testResults.success ? '✅' : '⚠️'}</span>
                <div className={styles.alertContent}>
                  <h4>{testResults.success ? 'การทดสอบสำเร็จ' : 'การทดสอบมีปัญหา'}</h4>
                  <p>{testResults.message}</p>
                  {testResults.data && (
                    <pre style={{ marginTop: '8px', fontSize: '0.85rem', color: '#666' }}>
                      {JSON.stringify(testResults.data, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>



  );
}
