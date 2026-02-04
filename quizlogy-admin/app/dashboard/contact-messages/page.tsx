'use client';

import { useState, useEffect } from 'react';
import { contactMessagesApi, ContactMessage } from '@/lib/api';
import './contact-messages.css';

export default function ContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await contactMessagesApi.getAll();
      setMessages(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching contact messages:', err);
      setError('Failed to load contact messages');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await contactMessagesApi.markAsRead(id);
      // Update local state
      setMessages(messages.map(msg => 
        msg.id === id ? { ...msg, isRead: true } : msg
      ));
    } catch (err: any) {
      console.error('Error marking message as read:', err);
      alert('Failed to mark message as read');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      setDeletingId(id);
      await contactMessagesApi.delete(id);
      setMessages(messages.filter(msg => msg.id !== id));
    } catch (err: any) {
      console.error('Error deleting message:', err);
      alert('Failed to delete message');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete ALL contact messages? This action cannot be undone.')) {
      setShowDeleteAllConfirm(false);
      return;
    }

    try {
      const response = await contactMessagesApi.deleteAll();
      setMessages([]);
      alert(`Successfully deleted ${response.count} message(s)`);
      setShowDeleteAllConfirm(false);
    } catch (err: any) {
      console.error('Error deleting all messages:', err);
      alert('Failed to delete all messages');
      setShowDeleteAllConfirm(false);
    }
  };

  const unreadCount = messages.filter(msg => !msg.isRead).length;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Contact Messages</h1>
        <div className="admin-actions">
          {unreadCount > 0 && (
            <span className="badge-new">{unreadCount} New</span>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              className="btn-danger"
            >
              Delete All
            </button>
          )}
          <button onClick={fetchMessages} className="btn-primary">
            Refresh
          </button>
        </div>
      </div>

      {showDeleteAllConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteAllConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Delete All Messages?</h3>
            <p>This will permanently delete all {messages.length} contact messages. This action cannot be undone.</p>
            <div className="modal-actions">
              <button onClick={handleDeleteAll} className="btn-danger">
                Yes, Delete All
              </button>
              <button onClick={() => setShowDeleteAllConfirm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading contact messages...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : messages.length === 0 ? (
        <div className="empty-state">
          <p>No contact messages yet.</p>
        </div>
      ) : (
        <div className="messages-container">
          <div className="messages-list">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message-card ${!message.isRead ? 'unread' : ''}`}
              >
                <div className="message-header">
                  <div className="message-info">
                    <div className="message-name-email">
                      <strong>{message.name}</strong>
                      <span className="message-email">{message.email}</span>
                    </div>
                    <div className="message-date">
                      {new Date(message.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="message-actions">
                    {!message.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(message.id)}
                        className="btn-mark-read"
                        title="Mark as read"
                      >
                        Mark as Read
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(message.id)}
                      className="btn-delete"
                      disabled={deletingId === message.id}
                      title="Delete message"
                    >
                      {deletingId === message.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
                <div className="message-content">
                  <p>{message.message}</p>
                </div>
                {!message.isRead && (
                  <div className="unread-indicator">NEW</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
