'use client';

import { useState, useEffect, useRef } from 'react';
import { contestsApi, Contest, CreateContestData, uploadApi, categoriesApi, Category } from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import * as XLSX from 'xlsx';
import ImageGallery from '@/components/ImageGallery';
import './contests.css';

export default function ContestManagement() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingContest, setEditingContest] = useState<Contest | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
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
    countries: ['ALL'] as string[],
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [startDateText, setStartDateText] = useState('');
  const [endDateText, setEndDateText] = useState('');
  const [resultDateText, setResultDateText] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const startDatePickerRef = useRef<HTMLInputElement>(null);
  const endDatePickerRef = useRef<HTMLInputElement>(null);
  const resultDatePickerRef = useRef<HTMLInputElement>(null);

  const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
  const isValidDateString = (s: string) => YYYY_MM_DD.test(s) && !isNaN(new Date(s + 'T12:00:00').getTime());
  const isPastDate = (dateOnly: string) => {
    const today = new Date();
    const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'), d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    return dateOnly < todayStr;
  };

  // Helpers: get date part (YYYY-MM-DD) or time part (HH:mm) for form inputs. Use local date so display is correct in user's timezone.
  const getDatePart = (iso: string | null | undefined): string => {
    if (!iso || typeof iso !== 'string') return '';
    const s = iso.trim();
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) {
      const part = s.indexOf('T') >= 0 ? s.split('T')[0] : s.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : '';
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const getTimePart = (iso: string | null | undefined): string => {
    if (!iso || typeof iso !== 'string') return '00:00';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '00:00';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  useEffect(() => {
    fetchContests();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchQuery]);

  useEffect(() => {
    setStartDateText(getDatePart(formData.startDate ?? ''));
    setEndDateText(getDatePart(formData.endDate ?? ''));
    setResultDateText(getDatePart(formData.resultDate ?? ''));
  }, [formData.startDate, formData.endDate, formData.resultDate]);

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
      const response = await contestsApi.getAll({
        page,
        limit,
        search: searchQuery || undefined,
      });
      setContests(response.data);
      setPagination(response.pagination);
      setError(null);
    } catch (err) {
      setError('Failed to fetch contests');
      console.error(err);
    } finally {
      setLoading(false);
      setInitialLoad(false);
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
    setError(null);
    setFieldErrors({});
    let committedDates: { startDate: string; endDate: string; resultDate: string } | null = null;

    if (isDaily) {
      const err: Record<string, string> = {};
      if (!fromTime || !toTime) {
        err.dailyTime = 'Please provide both start time and end time for daily contests';
      } else {
        const [startH, startM] = fromTime.split(':').map(Number);
        const [endH, endM] = toTime.split(':').map(Number);
        if (endH * 60 + endM <= startH * 60 + startM) {
          err.dailyTime = 'End time must be after start time';
        }
      }
      if (Object.keys(err).length) {
        setFieldErrors(err);
        setError('Please fix the errors below.');
        return;
      }
    } else {
      const err: Record<string, string> = {};
      const sStart = startDateText.trim().replace(/\//g, '-');
      const sEnd = endDateText.trim().replace(/\//g, '-');
      const sResult = resultDateText.trim().replace(/\//g, '-');
      if (!sStart) err.startDate = 'Start date is required';
      else if (!isValidDateString(sStart)) err.startDate = 'Start date must be YYYY-MM-DD (e.g. 2025-12-01)';
      if (!sEnd) err.endDate = 'End date is required';
      else if (!isValidDateString(sEnd)) err.endDate = 'End date must be YYYY-MM-DD';
      if (sStart && isValidDateString(sStart) && sEnd && isValidDateString(sEnd) && sStart >= sEnd) err.startDate = 'Start date must be before end date';
      if (sResult && !isValidDateString(sResult)) err.resultDate = 'Result date must be YYYY-MM-DD';
      else if (sResult && sEnd && isValidDateString(sEnd) && sResult < sEnd) err.resultDate = 'Result date must be on or after end date';
      if (Object.keys(err).length) {
        setFieldErrors(err);
        return;
      }
      const timeStart = formData.startDate ? getTimePart(formData.startDate) : fromTime || '15:00';
      const timeEnd = formData.endDate ? getTimePart(formData.endDate) : toTime || '16:00';
      committedDates = {
        startDate: new Date(`${sStart}T${timeStart}:00.000`).toISOString(),
        endDate: new Date(`${sEnd}T${timeEnd}:00.000`).toISOString(),
        resultDate: sResult ? new Date(`${sResult}T00:00:00.000`).toISOString() : (formData.resultDate ?? ''),
      };
      setFormData((prev) => ({ ...prev, ...committedDates }));
      if (formData.categoryId) {
        const collidingContest = checkCollisionWithExisting(
          formData.categoryId,
          new Date(committedDates.startDate),
          new Date(committedDates.endDate),
          editingContest?.id
        );
        if (collidingContest) {
          setFieldErrors((e) => ({ ...e, dates: `Time overlaps with "${collidingContest.name}". Choose a different slot.` }));
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
        submitData.dailyStartTime = fromTime;
        submitData.dailyEndTime = toTime;
        submitData.startDate = null;
        submitData.endDate = null;
        submitData.resultDate = null;
      } else {
        if (committedDates) {
          submitData.startDate = committedDates.startDate;
          submitData.endDate = committedDates.endDate;
          submitData.resultDate = committedDates.resultDate || committedDates.endDate;
        }
        submitData.dailyStartTime = null;
        submitData.dailyEndTime = null;
      }
      if (editingContest) {
        await contestsApi.update(editingContest.id, submitData);
      } else {
        await contestsApi.create(submitData);
      }
      setFieldErrors({});
      setError(null);
      resetForm();
      fetchContests();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save contest';
      setError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
      // Do not reset form so user can fix and try again
    }
  };

  const handleEdit = (contest: Contest) => {
    setEditingContest(contest);
    // Inherit countries from the category, not the contest
    const cat = categories.find(c => c.id === contest.categoryId);
    const catCountries = cat?.countries || contest.countries || ['ALL'];
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
      countries: catCountries,
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
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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
          countries: (() => {
            // Inherit countries from category
            const cat = categories.find(c => c.id === categoryId);
            return cat?.countries || ['ALL'];
          })(),
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
      Countries: Array.isArray(item.countries) ? item.countries.join(', ') : (item.countries || item.region || 'ALL'),
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
          countries: (() => {
            // Inherit countries from category
            const cat = categories.find(c => c.id === (item.categoryId?.trim() || ''));
            return cat?.countries || ['ALL'];
          })(),
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
        Countries: contest.countries?.join(', ') || contest.region || 'ALL',
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
      countries: ['ALL'],
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

  if (initialLoad) {
    return <div className="loading">Loading contests...</div>;
  }

  return (
    <div className="contest-management admin-page">
      <div className="admin-page-header page-header">
        <h1>Contest Management</h1>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Search contests..."
            value={searchInput}
            onChange={(e) => {
              const value = e.target.value;
              setSearchInput(value);
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              searchTimerRef.current = setTimeout(() => {
                setSearchQuery(value);
                setPage(1);
              }, 400);
            }}
            className="search-input"
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', marginRight: '10px' }}
          />
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
        <form ref={formRef} onSubmit={handleSubmit} className="contest-form modern-form">
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
            <div className="contest-type-toggle">
              <button
                type="button"
                className={`toggle-option ${contestType === 'FREE' ? 'active' : ''}`}
                onClick={() => {
                  setContestType('FREE');
                  setFormData({ ...formData, joiningFee: 0 });
                }}
              >
                🎁 Free
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
                💰 Paid
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
                    
                    // Auto-inherit countries from the selected category
                    const selectedCat = categories.find(c => c.id === newCategoryId);
                    const catCountries = selectedCat?.countries || ['ALL'];

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
                      countries: catCountries,
                      marking: prev.marking || 20,
                      negativeMarking: prev.negativeMarking || 5,
                      lifeLineCharge: prev.lifeLineCharge || 10,
                    }));
                    setFromTime(nextSlot.startTime);
                    setToTime(nextSlot.endTime);
                  }
                } else {
                  // Auto-inherit countries from the selected category
                  const selectedCat = categories.find(c => c.id === newCategoryId);
                  const catCountries = selectedCat?.countries || ['ALL'];
                  setFormData({ ...formData, categoryId: newCategoryId, countries: catCountries });
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

          {/* Countries (inherited from category) */}
          <div className="form-group">
            <label>Countries</label>
            <div style={{
              padding: '8px 12px',
              background: 'var(--admin-muted-bg, #f3f4f6)',
              border: '1px solid var(--admin-border, #d1d5db)',
              borderRadius: '6px',
              fontSize: '14px',
              color: 'var(--admin-text-muted, #6b7280)',
            }}>
              {(formData.countries || ['ALL']).join(', ')}
              <span style={{ marginLeft: '8px', fontSize: '12px', opacity: 0.7 }}>
                (inherited from category)
              </span>
            </div>
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
              {fieldErrors.dailyTime && <div className="field-error-message">{fieldErrors.dailyTime}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label>Daily Start Time *</label>
                  <input
                    type="time"
                    value={fromTime}
                    onChange={(e) => setFromTime(e.target.value)}
                    className={fieldErrors.dailyTime ? 'field-error' : ''}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Daily End Time *</label>
                  <input
                    type="time"
                    value={toTime}
                    onChange={(e) => setToTime(e.target.value)}
                    className={fieldErrors.dailyTime ? 'field-error' : ''}
                    required
                  />
                </div>
              </div>
            </>
          ) : (
            /* Regular Contest - Dates and Times */
            <>
              {/* Start Date - type YYYY-MM-DD or use calendar button */}
              <div className="form-group">
                <label>Start Date * (YYYY-MM-DD)</label>
                <div className="date-field-with-calendar">
                  <input
                    type="text"
                    placeholder="YYYY-MM-DD"
                    value={startDateText}
                    onChange={(e) => setStartDateText(e.target.value)}
                    onBlur={() => {
                      const s = startDateText.trim().replace(/\//g, '-');
                      if (!s) {
                        setFormData({ ...formData, startDate: '' });
                        setFieldErrors((e) => ({ ...e, startDate: '' }));
                        return;
                      }
                      if (!isValidDateString(s)) {
                        setFieldErrors((e) => ({ ...e, startDate: 'Use YYYY-MM-DD (e.g. 2025-12-01)' }));
                        return;
                      }
                      const time = formData.startDate ? getTimePart(formData.startDate) : fromTime || '15:00';
                      setFormData({ ...formData, startDate: new Date(`${s}T${time}:00.000`).toISOString() });
                      setFieldErrors((e) => ({ ...e, startDate: '' }));
                    }}
                    className={fieldErrors.startDate ? 'field-error' : ''}
                    aria-label="Start date"
                  />
                  <input
                    ref={startDatePickerRef}
                    type="date"
                    className="hidden-date-picker"
                    value={startDateText && isValidDateString(startDateText) ? startDateText : ''}
                    onChange={(e) => {
                      const date = e.target.value;
                      if (!date) return;
                      setStartDateText(date);
                      const time = formData.startDate ? getTimePart(formData.startDate) : fromTime || '15:00';
                      setFormData((prev) => ({ ...prev, startDate: new Date(`${date}T${time}:00.000`).toISOString() }));
                      setFieldErrors((e) => ({ ...e, startDate: '' }));
                    }}
                    aria-hidden
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    className="calendar-btn"
                    onClick={() => startDatePickerRef.current?.showPicker?.()}
                    title="Open calendar"
                    aria-label="Open calendar"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </button>
                </div>
                {fieldErrors.startDate && <span className="field-error-text">{fieldErrors.startDate}</span>}
              </div>

              {/* End Date - type YYYY-MM-DD or use calendar button */}
              <div className="form-group">
                <label>End Date * (YYYY-MM-DD)</label>
                <div className="date-field-with-calendar">
                  <input
                    type="text"
                    placeholder="YYYY-MM-DD"
                    value={endDateText}
                    onChange={(e) => setEndDateText(e.target.value)}
                    onBlur={() => {
                      const s = endDateText.trim().replace(/\//g, '-');
                      if (!s) {
                        setFormData({ ...formData, endDate: '' });
                        setFieldErrors((e) => ({ ...e, endDate: '' }));
                        return;
                      }
                      if (!isValidDateString(s)) {
                        setFieldErrors((e) => ({ ...e, endDate: 'Use YYYY-MM-DD (e.g. 2025-12-01)' }));
                        return;
                      }
                      const time = formData.endDate ? getTimePart(formData.endDate) : toTime || '16:00';
                      setFormData({ ...formData, endDate: new Date(`${s}T${time}:00.000`).toISOString() });
                      setFieldErrors((e) => ({ ...e, endDate: '' }));
                    }}
                    className={fieldErrors.endDate ? 'field-error' : ''}
                    aria-label="End date"
                  />
                  <input
                    ref={endDatePickerRef}
                    type="date"
                    className="hidden-date-picker"
                    value={endDateText && isValidDateString(endDateText) ? endDateText : ''}
                    onChange={(e) => {
                      const date = e.target.value;
                      if (!date) return;
                      setEndDateText(date);
                      const time = formData.endDate ? getTimePart(formData.endDate) : toTime || '16:00';
                      setFormData((prev) => ({ ...prev, endDate: new Date(`${date}T${time}:00.000`).toISOString() }));
                      setFieldErrors((e) => ({ ...e, endDate: '' }));
                    }}
                    aria-hidden
                    tabIndex={-1}
                  />
                  <button type="button" className="calendar-btn" onClick={() => endDatePickerRef.current?.showPicker?.()} title="Open calendar" aria-label="Open calendar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </button>
                </div>
                {fieldErrors.endDate && <span className="field-error-text">{fieldErrors.endDate}</span>}
              </div>

              {/* Result Date - type YYYY-MM-DD or use calendar button */}
              <div className="form-group">
                <label>Result Date (YYYY-MM-DD)</label>
                <div className="date-field-with-calendar">
                  <input
                    type="text"
                    placeholder="YYYY-MM-DD"
                    value={resultDateText}
                    onChange={(e) => setResultDateText(e.target.value)}
                    onBlur={() => {
                      const s = resultDateText.trim().replace(/\//g, '-');
                      if (!s) {
                        setFormData({ ...formData, resultDate: '' });
                        setFieldErrors((e) => ({ ...e, resultDate: '' }));
                        return;
                      }
                      if (!isValidDateString(s)) {
                        setFieldErrors((e) => ({ ...e, resultDate: 'Use YYYY-MM-DD' }));
                        return;
                      }
                      const endPart = getDatePart(formData.endDate ?? '');
                      if (endPart && s < endPart) {
                        setFieldErrors((e) => ({ ...e, resultDate: 'Result date must be on or after end date' }));
                        return;
                      }
                      setFormData({ ...formData, resultDate: new Date(`${s}T00:00:00.000`).toISOString() });
                      setFieldErrors((e) => ({ ...e, resultDate: '' }));
                    }}
                    className={fieldErrors.resultDate ? 'field-error' : ''}
                    aria-label="Result date"
                  />
                  <input
                    ref={resultDatePickerRef}
                    type="date"
                    className="hidden-date-picker"
                    min={endDateText && isValidDateString(endDateText) ? endDateText : undefined}
                    value={resultDateText && isValidDateString(resultDateText) ? resultDateText : ''}
                    onChange={(e) => {
                      const date = e.target.value;
                      if (!date) return;
                      setResultDateText(date);
                      setFormData((prev) => ({ ...prev, resultDate: new Date(`${date}T00:00:00.000`).toISOString() }));
                      setFieldErrors((e) => ({ ...e, resultDate: '' }));
                    }}
                    aria-hidden
                    tabIndex={-1}
                  />
                  <button type="button" className="calendar-btn" onClick={() => resultDatePickerRef.current?.showPicker?.()} title="Open calendar" aria-label="Open calendar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </button>
                </div>
                {fieldErrors.resultDate && <span className="field-error-text">{fieldErrors.resultDate}</span>}
              </div>
              {fieldErrors.dates && <div className="field-error-message">{fieldErrors.dates}</div>}

              {/* Start Time and End Time - only update that field's time, keep dates unchanged */}
              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={formData.startDate ? getTimePart(formData.startDate) : fromTime}
                    onChange={(e) => {
                      const t = e.target.value;
                      setFromTime(t);
                      const datePart = formData.startDate ? getDatePart(formData.startDate) : getDatePart(new Date().toISOString());
                      setFormData({ ...formData, startDate: new Date(`${datePart}T${t}:00.000`).toISOString() });
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={formData.endDate ? getTimePart(formData.endDate) : toTime}
                    onChange={(e) => {
                      const t = e.target.value;
                      setToTime(t);
                      const datePart = formData.endDate ? getDatePart(formData.endDate) : getDatePart(new Date().toISOString());
                      setFormData({ ...formData, endDate: new Date(`${datePart}T${t}:00.000`).toISOString() });
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
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
              <th>Countries</th>
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  <td>{contest.countries?.join(', ') || contest.region || 'ALL'}</td>
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
                  <td>
                    {contest.joiningFee > 0 ? (
                      <span className="contest-type-badge contest-type-paid">💰 {contest.joiningFee} coins</span>
                    ) : (
                      <span className="contest-type-badge contest-type-free">🎁 Free</span>
                    )}
                  </td>
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

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '20px', marginBottom: '20px' }}>
          <button
            className="pagination-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}
          >
            Previous
          </button>
          <span className="pagination-info" style={{ color: '#666' }}>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total contests)
          </span>
          <button
            className="pagination-btn"
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages}
            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ddd', cursor: page === pagination.totalPages ? 'not-allowed' : 'pointer', opacity: page === pagination.totalPages ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
      )}

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

