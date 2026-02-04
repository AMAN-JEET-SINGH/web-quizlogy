'use client';

import { useState, useEffect } from 'react';
import { contestsApi, Contest, CreateContestData, uploadApi, categoriesApi, Category } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import * as XLSX from 'xlsx';
import ImageGallery from '@/components/ImageGallery';
import './contests.css';

export default function ContestManagement() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingContest, setEditingContest] = useState<Contest | null>(null);
  const [formData, setFormData] = useState<CreateContestData>({
    name: '',
    description: '',
    categoryId: '',
    imagePath: '',
    startDate: '',
    endDate: '',
    resultDate: '',
    joiningFee: 0,
    questionCount: 20,
    duration: 60,
    region: 'ALL',
    prizePool: JSON.stringify(["50000", "40000", "30000", "20000", "10000", "5000", "4000", "3000", "2000", "1000"]),
    marking: 20,
    negativeMarking: 5,
    lifeLineCharge: 10,
  });
  const [contestType, setContestType] = useState<'FREE' | 'PAID'>('FREE');
  const [isDaily, setIsDaily] = useState(false);
  const [fromTime, setFromTime] = useState('15:00');
  const [toTime, setToTime] = useState('16:00');
  const [questionPoolSize, setQuestionPoolSize] = useState(50);
  const [winCoinsForTitle, setWinCoinsForTitle] = useState(5000);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [importedData, setImportedData] = useState<any[]>([]);
  const [showImageSelection, setShowImageSelection] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchContests();
    fetchCategories();
  }, []);

  // Helper function to check if two date-time ranges overlap
  const checkTimeCollision = (
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean => {
    return start1 < end2 && start2 < end1;
  };

  // Get contests for a specific category
  const getContestsByCategory = (categoryId: string): Contest[] => {
    return contests.filter(c => c.categoryId === categoryId);
  };

  // Get the next available time slot for a category (always 1 hour ahead of last contest or current time, whichever is later)
  const getNextAvailableTimeSlot = (categoryId: string): { startDate: string; endDate: string; startTime: string; endTime: string; resultDate: string } | null => {
    if (!categoryId) return null;

    const categoryContests = getContestsByCategory(categoryId)
      .filter(c => !(c as any).isDaily && c.startDate && c.endDate)
      .map(c => ({
        start: new Date(c.startDate!),
        end: new Date(c.endDate!),
      }))
      .sort((a, b) => a.end.getTime() - b.end.getTime());

    let nextStart: Date;
    const now = new Date();
    const currentTimePlus1Hour = new Date(now);
    currentTimePlus1Hour.setHours(currentTimePlus1Hour.getHours() + 1);
    currentTimePlus1Hour.setMinutes(0, 0, 0); // Round to nearest hour
    
    if (categoryContests.length === 0) {
      // No contests in this category, use current time + 1 hour
      nextStart = currentTimePlus1Hour;
    } else {
      // Get the last contest's end time and add exactly 1 hour
      const lastContest = categoryContests[categoryContests.length - 1];
      const lastContestEndPlus1Hour = new Date(lastContest.end);
      lastContestEndPlus1Hour.setHours(lastContestEndPlus1Hour.getHours() + 1);
      lastContestEndPlus1Hour.setMinutes(0, 0, 0); // Round to nearest hour
      
      // Use whichever is later: current time + 1 hour OR last contest end + 1 hour
      nextStart = lastContestEndPlus1Hour > currentTimePlus1Hour ? lastContestEndPlus1Hour : currentTimePlus1Hour;
    }

    // End date is 7 days from start date
    const nextEnd = new Date(nextStart);
    nextEnd.setDate(nextEnd.getDate() + 7);
    
    // Result date is 1 day after end date
    const resultDate = new Date(nextEnd);
    resultDate.setDate(resultDate.getDate() + 1);

    return {
      startDate: nextStart.toISOString().split('T')[0],
      endDate: nextEnd.toISOString().split('T')[0],
      startTime: `${String(nextStart.getHours()).padStart(2, '0')}:${String(nextStart.getMinutes()).padStart(2, '0')}`,
      endTime: `${String(nextEnd.getHours()).padStart(2, '0')}:${String(nextEnd.getMinutes()).padStart(2, '0')}`,
      resultDate: resultDate.toISOString().split('T')[0],
    };
  };

  // Check if the current contest time collides with existing contests in the same category
  const checkCollisionWithExisting = (
    categoryId: string,
    startDate: Date,
    endDate: Date,
    excludeContestId?: string
  ): Contest | null => {
    if (!categoryId) return null;

    const categoryContests = getContestsByCategory(categoryId)
      .filter(c => {
        // Exclude the contest being edited
        if (excludeContestId && c.id === excludeContestId) return false;
        // Only check non-daily contests with dates
        if ((c as any).isDaily || !c.startDate || !c.endDate) return false;
        return true;
      });

    for (const contest of categoryContests) {
      const contestStart = new Date(contest.startDate!);
      const contestEnd = new Date(contest.endDate!);
      
      if (checkTimeCollision(startDate, endDate, contestStart, contestEnd)) {
        return contest;
      }
    }

    return null;
  };

  const fetchContests = async () => {
    try {
      setLoading(true);
      const data = await contestsApi.getAll();
      setContests(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch contests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await categoriesApi.getAll();
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate time for daily contests
    if (isDaily) {
      if (!fromTime || !toTime) {
        alert('Please provide both start time and end time for daily contests');
        return;
      }
      
      // Convert times to minutes for comparison
      const [startHours, startMinutes] = fromTime.split(':').map(Number);
      const [endHours, endMinutes] = toTime.split(':').map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      
      if (endTotalMinutes <= startTotalMinutes) {
        alert('End time must be after start time. Please select a valid time range.');
        return;
      }
    } else {
      // Validate dates for regular contests
      if (!formData.startDate || !formData.endDate) {
        alert('Please provide start date and end date for regular contests');
        return;
      }
      
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      
      // Prevent past dates
      const now = new Date();
      now.setSeconds(0, 0); // Reset seconds and milliseconds for comparison
      if (startDate < now) {
        alert('Cannot create contest in the past. Please select a future start date.');
        return;
      }
      
      if (endDate <= startDate) {
        alert('End date must be after start date');
        return;
      }

      // Check for time collisions in the same category
      if (formData.categoryId) {
        const collidingContest = checkCollisionWithExisting(
          formData.categoryId,
          startDate,
          endDate,
          editingContest?.id
        );

        if (collidingContest) {
          const collidingStart = new Date(collidingContest.startDate!);
          const collidingEnd = new Date(collidingContest.endDate!);
          alert(
            `Time collision detected! This contest overlaps with "${collidingContest.name}" ` +
            `(${collidingStart.toLocaleString()} - ${collidingEnd.toLocaleString()}). ` +
            `Please select a different time slot.`
          );
          return;
        }
      }
    }
    
    try {
      const submitData: any = {
        ...formData,
        joiningFee: contestType === 'FREE' ? 0 : formData.joiningFee,
        isDaily: isDaily,
      };
      
      if (isDaily) {
        // For daily contests, only send times, not dates
        submitData.dailyStartTime = fromTime;
        submitData.dailyEndTime = toTime;
        submitData.startDate = null;
        submitData.endDate = null;
        submitData.resultDate = null;
      } else {
        // For regular contests, ensure result date is set
        submitData.resultDate = formData.resultDate || formData.endDate;
        submitData.dailyStartTime = null;
        submitData.dailyEndTime = null;
      }
      
      if (editingContest) {
        await contestsApi.update(editingContest.id, submitData);
      } else {
        await contestsApi.create(submitData);
      }
      resetForm();
      fetchContests();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save contest');
    }
  };

  const handleEdit = (contest: Contest) => {
    setEditingContest(contest);
    setFormData({
      name: contest.name,
      description: contest.description || '',
      categoryId: contest.categoryId,
      imagePath: contest.imagePath,
      startDate: contest.startDate,
      endDate: contest.endDate,
      resultDate: contest.resultDate,
      joiningFee: contest.joiningFee || 0,
      questionCount: contest.questionCount || 20,
      duration: contest.duration || 60,
      region: contest.region || 'ALL',
      prizePool: contest.prizePool || JSON.stringify(["50000", "40000", "30000", "20000", "10000", "5000", "4000", "3000", "2000", "1000"]),
      marking: contest.marking || 20,
      negativeMarking: contest.negativeMarking || 5,
      lifeLineCharge: contest.lifeLineCharge || 10,
    });
    setContestType(contest.joiningFee > 0 ? 'PAID' : 'FREE');
    
    // Check if contest is daily (has dailyStartTime and dailyEndTime, or no startDate/endDate)
    const contestIsDaily = (contest as any).isDaily || (!contest.startDate && !contest.endDate);
    setIsDaily(contestIsDaily);
    
    if (contestIsDaily) {
      // For daily contests, use daily times
      const dailyStartTime = (contest as any).dailyStartTime || '15:00';
      const dailyEndTime = (contest as any).dailyEndTime || '16:00';
      setFromTime(dailyStartTime);
      setToTime(dailyEndTime);
    } else {
      // For regular contests, extract time from dates
      if (contest.startDate && contest.endDate) {
        const startDate = new Date(contest.startDate);
        const endDate = new Date(contest.endDate);
        setFromTime(`${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`);
        setToTime(`${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`);
      } else {
        // Fallback if dates are missing
        setFromTime('15:00');
        setToTime('16:00');
      }
    }
    
    // Parse prize pool to get win coins
    try {
      const prizePool = typeof contest.prizePool === 'string' ? JSON.parse(contest.prizePool) : contest.prizePool;
      if (Array.isArray(prizePool) && prizePool.length > 0) {
        setWinCoinsForTitle(parseInt(prizePool[0]) || 5000);
      }
    } catch {
      setWinCoinsForTitle(5000);
    }
    
    setQuestionPoolSize(50); // Default, can be enhanced later
    setShowForm(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(contests.map((c) => c.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one contest to delete.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected contest(s)?`)) return;
    try {
      setLoading(true);
      for (const id of selectedIds) {
        await contestsApi.delete(id);
      }
      setSelectedIds(new Set());
      fetchContests();
    } catch (err) {
      setError('Failed to delete selected contests');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this contest?')) {
      return;
    }
    try {
      await contestsApi.delete(id);
      fetchContests();
    } catch (err) {
      setError('Failed to delete contest');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Fetch categories to match by name
      const allCategories = await categoriesApi.getAll();
      const categoryMap = new Map<string, string>(); // name -> id
      allCategories.forEach(cat => {
        categoryMap.set(cat.name.toLowerCase().trim(), cat.id);
      });

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      const imported: any[] = [];
      const errors: string[] = [];

      for (const row of jsonData as any[]) {
        // Parse dates - handle various formats
        const parseDate = (dateValue: any): string | null => {
          if (!dateValue) return null;
          if (dateValue instanceof Date) {
            if (isNaN(dateValue.getTime())) return null;
            return dateValue.toISOString();
          }
          if (typeof dateValue === 'string') {
            const parsed = new Date(dateValue);
            if (!isNaN(parsed.getTime())) return parsed.toISOString();
          }
          return null;
        };

        // Parse prize pool
        let prizePool = ["50000", "40000", "30000", "20000", "10000", "5000", "4000", "3000", "2000", "1000"];
        const prizePoolValue = row.prizePool || row['Prize Pool'];
        if (prizePoolValue) {
          if (typeof prizePoolValue === 'string') {
            try {
              // Try parsing as JSON first
              prizePool = JSON.parse(prizePoolValue);
            } catch {
              // If not JSON, try splitting by comma
              prizePool = prizePoolValue.split(',').map((p: string) => p.trim()).filter(Boolean);
            }
          } else if (Array.isArray(prizePoolValue)) {
            prizePool = prizePoolValue;
          }
        }

        // Check if this is a daily contest
        const isDailyValue = row.isDaily || row['Is Daily'] || row['isDaily'];
        const isDaily = isDailyValue === true || isDailyValue === 'Yes' || isDailyValue === 'yes' || isDailyValue === 'YES' || isDailyValue === 1 || isDailyValue === '1';
        
        const dailyStartTime = row.dailyStartTime || row['Daily Start Time'] || '';
        const dailyEndTime = row.dailyEndTime || row['Daily End Time'] || '';

        // Resolve category ID - try ID first, then name
        let categoryId = row.categoryId || row['Category ID'] || '';
        const categoryName = row.category || row.Category || '';
        
        // If categoryId is not valid, try to find by name
        if (!categoryId || !allCategories.find(c => c.id === categoryId)) {
          if (categoryName) {
            const foundCategory = allCategories.find(c => 
              c.name.toLowerCase().trim() === categoryName.toLowerCase().trim()
            );
            if (foundCategory) {
              categoryId = foundCategory.id;
            } else {
              errors.push(`${row.name || row.Name || 'Unknown'}: Category "${categoryName}" not found`);
              continue;
            }
          } else {
            errors.push(`${row.name || row.Name || 'Unknown'}: Category ID or Name is required`);
            continue;
          }
        }

        const contestData: any = {
          name: row.name || row.Name || '',
          description: row.description || row.Description || '',
          categoryId: categoryId,
          imagePath: row.imagePath || row['Image Path'] || row.image || '',
          isDaily: isDaily,
          joiningFee: parseInt(row.joiningFee || row['Joining Fee'] || '0'),
          questionCount: parseInt(row.questionCount || row['Question Count'] || '10'),
          duration: parseInt(row.duration || row.Duration || '90'),
          region: row.region || row.Region || 'ALL',
          prizePool: JSON.stringify(prizePool),
          marking: parseInt(row.marking || row.Marking || '20'),
          negativeMarking: parseInt(row.negativeMarking || row['Negative Marking'] || '5'),
          lifeLineCharge: parseInt(row.lifeLineCharge || row['Lifeline Charge'] || row['LifeLine Charge'] || '1'),
          category: categoryName, // For display purposes
        };

        // Set dates or daily times based on contest type
        if (isDaily) {
          contestData.dailyStartTime = dailyStartTime || '15:00';
          contestData.dailyEndTime = dailyEndTime || '16:00';
          contestData.startDate = null;
          contestData.endDate = null;
          contestData.resultDate = null;
        } else {
          const startDate = parseDate(row.startDate || row['Start Date']);
          const endDate = parseDate(row.endDate || row['End Date']);
          const resultDate = parseDate(row.resultDate || row['Result Date']);

          // Validate dates
          if (!startDate || !endDate) {
            errors.push(`${contestData.name}: Start date and end date are required for regular contests`);
            continue;
          }

          const start = new Date(startDate);
          const end = new Date(endDate);
          
          if (end <= start) {
            errors.push(`${contestData.name}: End date must be after start date (Start: ${start.toLocaleDateString()}, End: ${end.toLocaleDateString()})`);
            continue;
          }

          contestData.startDate = startDate;
          contestData.endDate = endDate;
          contestData.resultDate = resultDate || endDate;
          contestData.dailyStartTime = null;
          contestData.dailyEndTime = null;
        }

        if (contestData.name && contestData.categoryId) {
          imported.push(contestData);
        } else {
          errors.push(`${contestData.name || 'Unknown'}: Missing required fields (name or categoryId)`);
        }
      }

      if (errors.length > 0) {
        console.warn('Import errors:', errors);
        alert(`Found ${errors.length} error(s) during import:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more` : ''}`);
      }

      if (imported.length > 0) {
        setImportedData(imported);
        setShowImageSelection(true);
      } else {
        alert('No valid contests found in the file.');
      }
    } catch (err) {
      setError('Failed to import contests');
      console.error(err);
    }

    e.target.value = '';
  };

  const handleImageSelectForImport = async (index: number, file: File) => {
    try {
      setUploadingImage(true);
      const result = await uploadApi.uploadImage(file, 'contests');
      const updated = [...importedData];
      updated[index].imagePath = result.path;
      setImportedData(updated);
    } catch (err) {
      setError('Failed to upload image');
      console.error(err);
    } finally {
      setUploadingImage(false);
    }
  };

  const downloadFailedContestsExcel = (failedRows: { item: any; error: string }[]) => {
    const data = failedRows.map(({ item, error }) => ({
      Name: item.name || '',
      Description: item.description || '',
      'Category ID': item.categoryId || '',
      'Image Path': item.imagePath || '',
      'Is Daily': item.isDaily ?? '',
      'Joining Fee': item.joiningFee ?? '',
      'Question Count': item.questionCount ?? '',
      Duration: item.duration ?? '',
      Region: item.region || 'ALL',
      'Start Date': item.startDate || '',
      'End Date': item.endDate || '',
      'Result Date': item.resultDate || '',
      Error: error,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Failed Contests');
    XLSX.writeFile(workbook, `contests_failed_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`);
  };

  const handleSaveImported = async () => {
    try {
      setLoading(true);
      let successCount = 0;
      const failedRows: { item: any; error: string }[] = [];

      for (const item of importedData) {
        const isDaily = item.isDaily === true || item.isDaily === 'true' || item.isDaily === 1 || item.isDaily === '1';

        const contestData: CreateContestData = {
          name: item.name?.trim() || '',
          description: item.description?.trim() || '',
          categoryId: item.categoryId?.trim() || '',
          imagePath: item.imagePath?.trim() || 'uploads/contests/default.jpg',
          isDaily: isDaily,
          joiningFee: parseInt(String(item.joiningFee || 0)),
          questionCount: parseInt(String(item.questionCount || 10)),
          duration: parseInt(String(item.duration || 90)),
          region: item.region?.trim() || 'ALL',
          prizePool: item.prizePool || JSON.stringify(["50000", "40000", "30000", "20000", "10000", "5000", "4000", "3000", "2000", "1000"]),
          marking: parseInt(String(item.marking || 20)),
          negativeMarking: parseInt(String(item.negativeMarking || 5)),
          lifeLineCharge: parseInt(String(item.lifeLineCharge || 1)),
        };

        if (isDaily) {
          contestData.dailyStartTime = item.dailyStartTime?.trim() || null;
          contestData.dailyEndTime = item.dailyEndTime?.trim() || null;
          contestData.startDate = null;
          contestData.endDate = null;
          contestData.resultDate = null;
        } else {
          contestData.startDate = item.startDate && item.startDate.trim() ? item.startDate : null;
          contestData.endDate = item.endDate && item.endDate.trim() ? item.endDate : null;
          contestData.resultDate = item.resultDate && item.resultDate.trim() ? item.resultDate : null;
          contestData.dailyStartTime = null;
          contestData.dailyEndTime = null;

          if (contestData.startDate && contestData.endDate) {
            const start = new Date(contestData.startDate);
            const end = new Date(contestData.endDate);
            if (end <= start) {
              failedRows.push({ item, error: 'End date must be after start date' });
              continue;
            }
          } else if (!contestData.startDate || !contestData.endDate) {
            failedRows.push({ item, error: 'Start date and end date are required for regular contests' });
            continue;
          }
        }

        if (!contestData.name || !contestData.categoryId) {
          failedRows.push({ item, error: 'Name and Category ID are required' });
          continue;
        }

        try {
          await contestsApi.create(contestData);
          successCount++;
        } catch (err: any) {
          const errorMsg = err?.response?.data?.error || err?.message || 'Unknown error';
          failedRows.push({ item, error: String(errorMsg) });
        }
      }

      if (failedRows.length > 0) {
        downloadFailedContestsExcel(failedRows);
      }

      setImportedData([]);
      setShowImageSelection(false);
      fetchContests();
      if (failedRows.length > 0) {
        alert(`Import completed! ${successCount} imported. ${failedRows.length} failed — failed rows downloaded as Excel.`);
      } else {
        alert(`Successfully imported ${successCount} contest(s).`);
      }
    } catch (err) {
      setError('Failed to save imported contests');
      console.error(err);
      alert('Failed to import contests. Please check the console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const result = await uploadApi.uploadImage(file, 'contests');
      setFormData({ ...formData, imagePath: result.path });
      setShowImageSelection(false);
    } catch (err) {
      setError('Failed to upload image');
      console.error(err);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleExport = () => {
    const data = contests.map((contest) => {
      // Parse prize pool if it's a string
      let prizePoolArray: string[] = [];
      try {
        if (typeof contest.prizePool === 'string') {
          prizePoolArray = JSON.parse(contest.prizePool);
        } else if (Array.isArray(contest.prizePool)) {
          prizePoolArray = contest.prizePool;
        }
      } catch (e) {
        prizePoolArray = ["50000", "40000", "30000", "20000", "10000", "5000", "4000", "3000", "2000", "1000"];
      }

      const isDaily = (contest as any).isDaily || false;

      return {
        Name: contest.name,
        Description: contest.description || '',
        'Category ID': contest.categoryId,
        Category: contest.category?.name || '',
        'Image Path': contest.imagePath,
        'Is Daily': isDaily ? 'Yes' : 'No',
        'Start Date': isDaily ? '' : (contest.startDate || ''),
        'End Date': isDaily ? '' : (contest.endDate || ''),
        'Result Date': isDaily ? '' : (contest.resultDate || ''),
        'Daily Start Time': isDaily ? ((contest as any).dailyStartTime || '') : '',
        'Daily End Time': isDaily ? ((contest as any).dailyEndTime || '') : '',
        'Joining Fee': contest.joiningFee || 0,
        'Question Count': contest.questionCount || 10,
        Duration: contest.duration || 90,
        Region: contest.region || 'ALL',
        'Prize Pool': prizePoolArray.join(', '),
        Marking: contest.marking || 20,
        'Negative Marking': contest.negativeMarking || 5,
        'Lifeline Charge': contest.lifeLineCharge || 1,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contests');
    XLSX.writeFile(workbook, `contests_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      categoryId: '',
      imagePath: '',
      startDate: '',
      endDate: '',
      resultDate: '',
      joiningFee: 0,
      questionCount: 20,
      duration: 60,
      region: 'ALL',
      prizePool: JSON.stringify(["50000", "40000", "30000", "20000", "10000", "5000", "4000", "3000", "2000", "1000"]),
      marking: 20,
      negativeMarking: 5,
      lifeLineCharge: 10,
    });
    setContestType('FREE');
    setIsDaily(false);
    setFromTime('15:00');
    setToTime('16:00');
    setQuestionPoolSize(50);
    setWinCoinsForTitle(5000);
    setEditingContest(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="loading">Loading contests...</div>;
  }

  return (
    <div className="contest-management admin-page">
      <div className="admin-page-header page-header">
        <h1>Contest Management</h1>
        <div className="header-actions">
          <label className="btn-import">
            Import from Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
          <button onClick={handleExport} className="btn-export">
            Export to Excel
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-add">
            {showForm ? 'Cancel' : 'Add Contest'}
          </button>
          {contests.length > 0 && (
            <>
              <button onClick={selectedIds.size === contests.length ? deselectAll : selectAll} className="btn-select-all">
                {selectedIds.size === contests.length ? 'Deselect All' : 'Select All'}
              </button>
              <button onClick={handleDeleteSelected} disabled={selectedIds.size === 0} className="btn-delete-selected">
                Delete Selected {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="contest-form modern-form">
          <h3>{editingContest ? 'Edit Contest' : 'Add Contest'}</h3>
          
          {/* Contest Image */}
          <div className="form-group">
            <label>Contest Image</label>
            <div className="file-upload-wrapper">
              <label className="file-upload-btn">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                  disabled={uploadingImage}
                />
                {uploadingImage ? 'Uploading...' : 'Upload New'}
              </label>
              <button
                type="button"
                className="file-upload-btn gallery-btn"
                onClick={() => setShowGallery(true)}
                style={{ marginLeft: '10px' }}
              >
                Choose from Gallery
              </button>
              <span className="file-name">{formData.imagePath ? formData.imagePath.split('/').pop() : 'No file chosen'}</span>
            </div>
            {formData.imagePath && (
              <div className="image-preview-small">
                <img 
                  src={(() => {
                    const url = getImageUrl(formData.imagePath);
                    // Ensure upload URLs use correct port
                    if (url && url.includes('/uploads/')) {
                      return url.replace(/localhost:\d+/, 'localhost:5001');
                    }
                    return url;
                  })()} 
                  alt="Preview" 
                  onError={(e) => {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                    (e.target as HTMLImageElement).src = `${apiUrl}/uploads/placeholder.jpg`;
                  }}
                />
              </div>
            )}
          </div>

          {/* Contest Type Toggle */}
          <div className="form-group">
            <label>Contest Type</label>
            <div className="toggle-switch">
              <button
                type="button"
                className={`toggle-option ${contestType === 'FREE' ? 'active' : ''}`}
                onClick={() => {
                  setContestType('FREE');
                  setFormData({ ...formData, joiningFee: 0 });
                }}
              >
                Free
              </button>
              <button
                type="button"
                className={`toggle-option ${contestType === 'PAID' ? 'active' : ''}`}
                onClick={() => {
                  setContestType('PAID');
                  // Set default joining fee if it's 0
                  if (formData.joiningFee === 0) {
                    setFormData({ ...formData, joiningFee: 20 });
                  }
                }}
              >
                Paid
              </button>
            </div>
          </div>

          {/* Entry Fee (only show for PAID contests) */}
          {contestType === 'PAID' && (
            <div className="form-group">
              <label>Entry Fee (Coins)</label>
              <input
                type="number"
                value={formData.joiningFee || 0}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setFormData({ ...formData, joiningFee: Math.max(0, value) });
                }}
                min="0"
                placeholder="Enter entry fee in coins"
                required={contestType === 'PAID'}
              />
              <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Amount in coins that users need to pay to join this contest
              </small>
            </div>
          )}

          {/* Pick a Category */}
          <div className="form-group">
            <label>Pick a Category *</label>
            <select
              value={formData.categoryId}
              onChange={(e) => {
                const newCategoryId = e.target.value;
                
                // Auto-fill all fields when category is selected (for both new and editing contests)
                if (!isDaily && newCategoryId) {
                  const nextSlot = getNextAvailableTimeSlot(newCategoryId);
                  if (nextSlot) {
                    // Auto-fill dates and times
                    const startDateTime = new Date(`${nextSlot.startDate}T${nextSlot.startTime}`);
                    const endDateTime = new Date(`${nextSlot.endDate}T${nextSlot.endTime}`);
                    const resultDateTime = new Date(`${nextSlot.resultDate}T00:00`);
                    
                    setFormData(prev => ({
                      ...prev,
                      categoryId: newCategoryId,
                      startDate: startDateTime.toISOString(),
                      endDate: endDateTime.toISOString(),
                      resultDate: resultDateTime.toISOString(),
                      // Keep existing values for other fields, or use defaults if empty
                      name: prev.name || '',
                      description: prev.description || '',
                      joiningFee: prev.joiningFee || 0,
                      questionCount: prev.questionCount || 20,
                      duration: prev.duration || 60,
                      region: prev.region || 'ALL',
                      marking: prev.marking || 20,
                      negativeMarking: prev.negativeMarking || 5,
                      lifeLineCharge: prev.lifeLineCharge || 10,
                    }));
                    setFromTime(nextSlot.startTime);
                    setToTime(nextSlot.endTime);
                  }
                } else {
                  setFormData({ ...formData, categoryId: newCategoryId });
                }
              }}
              required
              className="form-select"
            >
              <option value="">Choose a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {formData.categoryId && !isDaily && (
              <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Auto-filled: Start 1hr after last contest (or current time + 1hr), End 7 days later, Result 1 day after end
              </small>
            )}
          </div>

          {/* Pick a Winner Coin Range */}
          <div className="form-group">
            <label>Pick a Winner Coin Range</label>
            <select
              value={winCoinsForTitle}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setWinCoinsForTitle(value);
                // Update prize pool with this as first prize
                const prizePool = [value.toString()];
                for (let i = 1; i < 10; i++) {
                  prizePool.push(Math.floor(value * (0.8 - i * 0.1)).toString());
                }
                setFormData({ ...formData, prizePool: JSON.stringify(prizePool) });
              }}
              className="form-select"
            >
              <option value="">Choose a winner coin rank</option>
              <option value="5000">5,000 Coins</option>
              <option value="10000">10,000 Coins</option>
              <option value="20000">20,000 Coins</option>
              <option value="50000">50,000 Coins</option>
              <option value="100000">100,000 Coins</option>
            </select>
          </div>

          {/* Pick a Region */}
          <div className="form-group">
            <label>Pick a Region</label>
            <select
              value={formData.region || 'ALL'}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              className="form-select"
            >
              <option value="">Choose a region</option>
              <option value="ALL">All Regions</option>
              <option value="IND">India Only</option>
            </select>
          </div>

          {/* Daily Contest Checkbox */}
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isDaily}
                onChange={(e) => {
                  setIsDaily(e.target.checked);
                  if (e.target.checked) {
                    // Clear dates when switching to daily
                    setFormData({ ...formData, startDate: '', endDate: '', resultDate: '' });
                  }
                }}
                style={{ marginRight: '8px', width: 'auto' }}
              />
              <span>Daily Contest (runs every day at specified times)</span>
            </label>
            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              {isDaily 
                ? 'For daily contests, the contest will run every day between the specified start and end times. No dates needed.'
                : 'For regular contests, specify start and end dates with times.'}
            </small>
          </div>

          {isDaily ? (
            /* Daily Contest - Only Times */
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Daily Start Time *</label>
                  <input
                    type="time"
                    value={fromTime}
                    onChange={(e) => {
                      setFromTime(e.target.value);
                      // Validate that end time is after start time
                      if (toTime && e.target.value >= toTime) {
                        alert('End time must be after start time');
                        return;
                      }
                    }}
                    required
                  />
                  <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Contest starts at this time every day
                  </small>
                </div>
                <div className="form-group">
                  <label>Daily End Time *</label>
                  <input
                    type="time"
                    value={toTime}
                    onChange={(e) => {
                      setToTime(e.target.value);
                      // Validate that end time is after start time
                      if (fromTime && e.target.value <= fromTime) {
                        alert('End time must be after start time');
                        return;
                      }
                    }}
                    required
                  />
                  <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    Contest ends at this time every day
                  </small>
                </div>
              </div>
            </>
          ) : (
            /* Regular Contest - Dates and Times */
            <>
              {/* Start Date */}
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const date = e.target.value;
                    const selectedDate = new Date(`${date}T00:00`);
                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    
                    if (selectedDate < now) {
                      alert('Cannot select a past date. Please select today or a future date.');
                      return;
                    }
                    
                    const time = fromTime || '15:00';
                    const newStartDate = new Date(`${date}T${time}`);
                    
                    // Auto-set end date to 7 days from start date
                    const newEndDate = new Date(newStartDate);
                    newEndDate.setDate(newEndDate.getDate() + 7);
                    
                    // Auto-set result date to 1 day after end date
                    const newResultDate = new Date(newEndDate);
                    newResultDate.setDate(newResultDate.getDate() + 1);
                    
                    setFormData({ 
                      ...formData, 
                      startDate: newStartDate.toISOString(),
                      endDate: newEndDate.toISOString(),
                      resultDate: newResultDate.toISOString(),
                    });
                    
                    // Update end time to match end date
                    setToTime(`${String(newEndDate.getHours()).padStart(2, '0')}:${String(newEndDate.getMinutes()).padStart(2, '0')}`);
                    
                    // Check for collision if category is selected
                    if (formData.categoryId && !editingContest) {
                      const collidingContest = checkCollisionWithExisting(
                        formData.categoryId,
                        newStartDate,
                        newEndDate
                      );
                      if (collidingContest) {
                        const collidingStart = new Date(collidingContest.startDate!);
                        const collidingEnd = new Date(collidingContest.endDate!);
                        alert(
                          `Warning: This time overlaps with "${collidingContest.name}" ` +
                          `(${collidingStart.toLocaleString()} - ${collidingEnd.toLocaleString()})`
                        );
                      }
                    }
                  }}
                  required
                />
              </div>

              {/* End Date */}
              <div className="form-group">
                <label>End Date * (Auto-set to 7 days from start)</label>
                <input
                  type="date"
                  min={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                  value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const date = e.target.value;
                    const selectedDate = new Date(`${date}T00:00`);
                    const startDate = formData.startDate ? new Date(formData.startDate) : new Date();
                    startDate.setHours(0, 0, 0, 0);
                    
                    if (selectedDate < startDate) {
                      alert('End date must be after start date.');
                      return;
                    }
                    
                    const time = toTime || '16:00';
                    const newEndDate = new Date(`${date}T${time}`);
                    
                    // Auto-set result date to 1 day after end date
                    const newResultDate = new Date(newEndDate);
                    newResultDate.setDate(newResultDate.getDate() + 1);
                    
                    setFormData({ 
                      ...formData, 
                      endDate: newEndDate.toISOString(),
                      resultDate: newResultDate.toISOString(),
                    });
                    
                    // Check for collision if category and start date are selected
                    if (formData.categoryId && formData.startDate && !editingContest) {
                      const startDate = new Date(formData.startDate);
                      const collidingContest = checkCollisionWithExisting(
                        formData.categoryId,
                        startDate,
                        newEndDate
                      );
                      if (collidingContest) {
                        const collidingStart = new Date(collidingContest.startDate!);
                        const collidingEnd = new Date(collidingContest.endDate!);
                        alert(
                          `Warning: This time overlaps with "${collidingContest.name}" ` +
                          `(${collidingStart.toLocaleString()} - ${collidingEnd.toLocaleString()})`
                        );
                      }
                    }
                  }}
                  required
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  Automatically set to 7 days from start date. Result date will be 1 day after end date.
                </small>
              </div>

              {/* Result Date */}
              <div className="form-group">
                <label>Result Date (Auto-set to 1 day after end date)</label>
                <input
                  type="date"
                  min={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                  value={formData.resultDate ? new Date(formData.resultDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const date = e.target.value;
                    const selectedDate = new Date(`${date}T00:00`);
                    const endDate = formData.endDate ? new Date(formData.endDate) : new Date();
                    endDate.setHours(0, 0, 0, 0);
                    
                    if (formData.endDate && selectedDate < endDate) {
                      alert('Result date must be on or after end date.');
                      return;
                    }
                    
                    setFormData({ ...formData, resultDate: new Date(`${date}T00:00`).toISOString() });
                  }}
                />
                <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                  Automatically set to 1 day after end date
                </small>
              </div>

              {/* From time and To time */}
              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={fromTime}
                    onChange={(e) => {
                      setFromTime(e.target.value);
                      if (formData.startDate) {
                        const date = new Date(formData.startDate).toISOString().split('T')[0];
                        const newStartDate = new Date(`${date}T${e.target.value}`);
                        
                        // Auto-update end date to 7 days from start
                        const newEndDate = new Date(newStartDate);
                        newEndDate.setDate(newEndDate.getDate() + 7);
                        
                        // Auto-update result date to 1 day after end
                        const newResultDate = new Date(newEndDate);
                        newResultDate.setDate(newResultDate.getDate() + 1);
                        
                        setFormData({ 
                          ...formData, 
                          startDate: newStartDate.toISOString(),
                          endDate: newEndDate.toISOString(),
                          resultDate: newResultDate.toISOString(),
                        });
                        
                        // Update end time
                        setToTime(`${String(newEndDate.getHours()).padStart(2, '0')}:${String(newEndDate.getMinutes()).padStart(2, '0')}`);
                        
                        // Check for collision if category is selected
                        if (formData.categoryId && !editingContest) {
                          const collidingContest = checkCollisionWithExisting(
                            formData.categoryId,
                            newStartDate,
                            newEndDate
                          );
                          if (collidingContest) {
                            const collidingStart = new Date(collidingContest.startDate!);
                            const collidingEnd = new Date(collidingContest.endDate!);
                            alert(
                              `Warning: This time overlaps with "${collidingContest.name}" ` +
                              `(${collidingStart.toLocaleString()} - ${collidingEnd.toLocaleString()})`
                            );
                          }
                        }
                      }
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={toTime}
                    onChange={(e) => {
                      setToTime(e.target.value);
                      if (formData.endDate) {
                        const date = new Date(formData.endDate).toISOString().split('T')[0];
                        const newEndDate = new Date(`${date}T${e.target.value}`);
                        
                        // Validate end time is after start time
                        if (formData.startDate) {
                          const startDate = new Date(formData.startDate);
                          if (newEndDate <= startDate) {
                            alert('End time must be after start time');
                            return;
                          }
                        }
                        
                        // Auto-update result date to 1 day after end
                        const newResultDate = new Date(newEndDate);
                        newResultDate.setDate(newResultDate.getDate() + 1);
                        
                        setFormData({ 
                          ...formData, 
                          endDate: newEndDate.toISOString(),
                          resultDate: newResultDate.toISOString(),
                        });
                        
                        // Check for collision if category is selected
                        if (formData.categoryId && formData.startDate && !editingContest) {
                          const startDate = new Date(formData.startDate);
                          const collidingContest = checkCollisionWithExisting(
                            formData.categoryId,
                            startDate,
                            newEndDate
                          );
                          if (collidingContest) {
                            const collidingStart = new Date(collidingContest.startDate!);
                            const collidingEnd = new Date(collidingContest.endDate!);
                            alert(
                              `Warning: This time overlaps with "${collidingContest.name}" ` +
                              `(${collidingStart.toLocaleString()} - ${collidingEnd.toLocaleString()})`
                            );
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Title with character counter */}
          <div className="form-group">
            <label>Title (Characters: {formData.name.length} / 60)</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                if (e.target.value.length <= 60) {
                  setFormData({ ...formData, name: e.target.value });
                }
              }}
              required
              placeholder="Enter the Contest Name"
              maxLength={60}
            />
          </div>

          {/* Duration in seconds */}
          <div className="form-group">
            <label>Duration in seconds</label>
            <input
              type="number"
              value={formData.duration || 60}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 60 })}
              min="1"
            />
          </div>

          {/* Life Line Charges */}
          <div className="form-group">
            <label>Life Line Charges</label>
            <input
              type="number"
              value={formData.lifeLineCharge || 10}
              onChange={(e) => setFormData({ ...formData, lifeLineCharge: parseInt(e.target.value) || 10 })}
              min="0"
            />
          </div>

          {/* Contest question count */}
          <div className="form-group">
            <label>Contest question count</label>
            <input
              type="number"
              value={formData.questionCount || 20}
              onChange={(e) => setFormData({ ...formData, questionCount: parseInt(e.target.value) || 20 })}
              min="1"
            />
          </div>

          {/* Question pool size */}
          <div className="form-group">
            <label>Question pool size</label>
            <input
              type="number"
              value={questionPoolSize}
              onChange={(e) => setQuestionPoolSize(parseInt(e.target.value) || 50)}
              min="1"
            />
          </div>

          {/* Win Coins for Title */}
          <div className="form-group">
            <label>Win Coins for Title</label>
            <input
              type="number"
              value={winCoinsForTitle}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 5000;
                setWinCoinsForTitle(value);
                // Update prize pool with this as first prize
                const prizePool = [value.toString()];
                for (let i = 1; i < 10; i++) {
                  prizePool.push(Math.floor(value * (0.8 - i * 0.1)).toString());
                }
                setFormData({ ...formData, prizePool: JSON.stringify(prizePool) });
              }}
              min="0"
            />
          </div>


          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={!formData.name || !formData.categoryId}>
              {editingContest ? 'Update Contest' : 'Create Contest'}
            </button>
            <button type="button" onClick={resetForm} className="btn-cancel">
              Cancel
            </button>
          </div>
        </form>
      )}

      {showImageSelection && importedData.length > 0 && (
        <div className="import-image-selection">
          <h3>Select Images for Imported Contests</h3>
          <p>Upload images for each contest. Contests without images will use default placeholder.</p>
          <div className="imported-items">
            {importedData.map((item, index) => (
              <div key={index} className="imported-item">
                <div className="item-info">
                  <strong>{item.name}</strong>
                  <p>Category: {item.category || item.categoryId}</p>
                  {item.description && <p className="item-description">{item.description}</p>}
                  <div className="item-details">
                    <span>Fee: {item.joiningFee || 0} coins</span>
                    <span>Questions: {item.questionCount || 10}</span>
                    <span>Duration: {item.duration || 90}s</span>
                  </div>
                </div>
                <div className="item-image">
                  {item.imagePath ? (
                    <div className="image-preview-small">
                      <img 
                        src={(() => {
                          const url = getImageUrl(item.imagePath);
                          // Ensure upload URLs use correct port
                          if (url && url.includes('/uploads/')) {
                            return url.replace(/localhost:\d+/, 'localhost:5001');
                          }
                          return url;
                        })()} 
                        alt={item.name}
                        onError={(e) => {
                          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                          (e.target as HTMLImageElement).src = `${apiUrl}/uploads/placeholder.jpg`;
                        }}
                      />
                      <button
                        onClick={() => {
                          const updated = [...importedData];
                          updated[index].imagePath = '';
                          setImportedData(updated);
                        }}
                        className="btn-remove"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="btn-upload-small">
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageSelectForImport(index, file);
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="import-actions">
            <button onClick={handleSaveImported} className="btn-save-import">
              Save All Contests
            </button>
            <button
              onClick={() => {
                setImportedData([]);
                setShowImageSelection(false);
              }}
              className="btn-cancel-import"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="contests-table-container">
        <table className="contests-table">
          <thead>
            <tr>
              <th className="col-select">
                <label className="table-checkbox-label">
                  <input
                    type="checkbox"
                    checked={contests.length > 0 && selectedIds.size === contests.length}
                    onChange={() => contests.length > 0 && (selectedIds.size === contests.length ? deselectAll() : selectAll())}
                  />
                </label>
              </th>
              <th>Image</th>
              <th>Name</th>
              <th>Category</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Joining Fee</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contests.map((contest) => {
              const isDailyContest = (contest as any).isDaily || (!contest.startDate && !contest.endDate);
              
              const getStatus = () => {
                if (isDailyContest) return 'DAILY';
                
                const now = new Date();
                if (!contest.startDate || !contest.endDate) return 'UNKNOWN';
                
                const start = new Date(contest.startDate);
                const end = new Date(contest.endDate);
                const result = contest.resultDate ? new Date(contest.resultDate) : end;
                
                if (now < start) return 'UPCOMING';
                if (now >= start && now <= end) return 'ACTIVE';
                if (now > end && now <= result) return 'RESULT_PENDING';
                return 'PREVIOUS';
              };

              const formatDate = (dateString: string | null) => {
                if (!dateString) return 'N/A';
                try {
                  return new Date(dateString).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                } catch {
                  return dateString;
                }
              };

              return (
                <tr key={contest.id}>
                  <td className="col-select">
                    <label className="table-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(contest.id)}
                        onChange={() => toggleSelect(contest.id)}
                      />
                    </label>
                  </td>
                  <td>
                    <img
                      src={(() => {
                        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                        // Use imageUrl from backend if available, otherwise generate from imagePath
                        let imgUrl = contest.imageUrl;
                        if (!imgUrl) {
                          imgUrl = getImageUrl(contest.imagePath);
                        }
                        // Always ensure upload URLs use the correct backend port
                        if (imgUrl && imgUrl.includes('/uploads/')) {
                          imgUrl = imgUrl.replace(/localhost:\d+/, 'localhost:5001');
                          if (!imgUrl.startsWith('http')) {
                            imgUrl = `${apiUrl}/${imgUrl}`;
                          }
                        }
                        return imgUrl || `${apiUrl}/uploads/placeholder.jpg`;
                      })()}
                      alt={contest.name}
                      className="contest-thumbnail"
                      onError={(e) => {
                        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                        (e.target as HTMLImageElement).src = `${apiUrl}/uploads/placeholder.jpg`;
                        console.error('Image failed to load:', contest.imageUrl || contest.imagePath);
                      }}
                      onLoad={() => {
                        console.log('Image loaded successfully:', contest.imageUrl || contest.imagePath);
                      }}
                    />
                  </td>
                  <td>
                    <strong>{contest.name}</strong>
                    {contest.description && (
                      <div className="contest-description-preview" title={contest.description}>
                        {contest.description.length > 50 
                          ? contest.description.substring(0, 50) + '...' 
                          : contest.description}
                      </div>
                    )}
                  </td>
                  <td>{contest.category?.name || contest.categoryId}</td>
                  <td>
                    {isDailyContest 
                      ? (contest as any).dailyStartTime || 'N/A'
                      : formatDate(contest.startDate)}
                  </td>
                  <td>
                    {isDailyContest 
                      ? (contest as any).dailyEndTime || 'N/A'
                      : formatDate(contest.endDate)}
                  </td>
                  <td>{contest.joiningFee || 0} coins</td>
                  <td>
                    <span className={`status-badge status-${getStatus().toLowerCase().replace('_', '-')}`}>
                      {getStatus()}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button onClick={() => handleEdit(contest)} className="btn-edit">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(contest.id)} className="btn-delete">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {contests.length === 0 && (
          <div className="no-data">No contests found. Create one to get started!</div>
        )}
      </div>
      
      {/* Image Gallery Modal - Always available */}
      <ImageGallery
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        onSelect={(imagePath) => {
          console.log('Setting image path in form:', imagePath);
          setFormData((prevFormData) => {
            const updated = { ...prevFormData, imagePath };
            console.log('Updated form data:', updated);
            return updated;
          });
        }}
        filterType="contests"
      />
    </div>
  );
}

