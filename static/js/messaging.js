(function () {
  function csrfToken() {
    const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function initMessaging() {
    const widget = document.querySelector('.ciet-message-widget');
    if (!widget || widget.dataset.ready === 'true') return;
    widget.dataset.ready = 'true';

    const list = document.getElementById('cietMessageList');
    const form = document.getElementById('cietMessageForm');
    const recipient = document.getElementById('cietMessageRecipient');
    const recipientWrap = widget.querySelector('.ciet-message-recipient-wrap');
    const parentInput = document.getElementById('cietMessageParent');
    const body = document.getElementById('cietMessageBody');
    const status = document.getElementById('cietMessageStatus');
    const replyNote = document.getElementById('cietMessageReplyNote');

    function setStatus(text) {
      if (status) status.textContent = text || '';
    }

    function setBadges(count) {
      document.querySelectorAll('[data-message-open]').forEach(function (button) {
        let badge = button.querySelector('.ciet-message-badge');
        if (count > 0) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'ciet-message-badge';
            button.appendChild(badge);
          }
          badge.textContent = count > 9 ? '9+' : String(count);
        } else if (badge) {
          badge.remove();
        }
      });
    }

    function renderMessages(messages) {
      if (!messages.length) {
        list.innerHTML = '<div class="ciet-message-state">No messages yet.</div>';
        return;
      }
      list.innerHTML = messages.map(function (message) {
        const title = message.direction === 'sent'
          ? 'To ' + message.recipient
          : 'From ' + message.sender;
        const reply = message.can_reply
          ? '<button type="button" class="ciet-message-reply" data-reply-to="' + escapeHtml(message.sender_id) + '" data-parent-id="' + escapeHtml(message.id) + '" data-reply-name="' + escapeHtml(message.sender) + '">Reply</button>'
          : '';
        return (
          '<article class="ciet-message-card is-' + escapeHtml(message.direction) + '">' +
            '<div class="ciet-message-meta"><span>' + escapeHtml(title) + '</span><span>' + escapeHtml(message.created_at) + '</span></div>' +
            '<p>' + escapeHtml(message.body) + '</p>' +
            reply +
          '</article>'
        );
      }).join('');
    }

    function renderRecipients(recipients, replyOnly) {
      recipient.innerHTML = recipients.map(function (user) {
        return '<option value="' + escapeHtml(user.id) + '">' + escapeHtml(user.name) + '</option>';
      }).join('');
      const hasRecipients = recipients.length > 0;
      recipient.disabled = !hasRecipients;
      body.disabled = !hasRecipients;
      form.querySelector('button[type="submit"]').disabled = !hasRecipients;
      recipientWrap.style.display = replyOnly ? 'none' : '';
      replyNote.textContent = replyOnly
        ? (hasRecipients ? 'Select Reply on a received message to respond.' : 'You can reply after a faculty member, mentor, or HOD messages you.')
        : '';
    }

    function loadInbox() {
      list.innerHTML = '<div class="ciet-message-state">Loading messages...</div>';
      setStatus('');
      fetch(widget.dataset.inboxUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function (response) { return response.json(); })
        .then(function (data) {
          renderMessages(data.messages || []);
          renderRecipients(data.recipients || [], data.reply_only);
          setBadges(data.unread_count || 0);
        })
        .catch(function () {
          list.innerHTML = '<div class="ciet-message-state">Unable to load messages right now.</div>';
        });
    }

    function openWidget() {
      widget.classList.add('is-open');
      loadInbox();
    }

    function closeWidget() {
      widget.classList.remove('is-open');
      setStatus('');
    }

    document.addEventListener('click', function (event) {
      const openButton = event.target.closest('[data-message-open]');
      if (openButton) {
        event.preventDefault();
        openWidget();
        return;
      }

      if (event.target.closest('[data-message-close]')) {
        event.preventDefault();
        closeWidget();
        return;
      }

      const replyButton = event.target.closest('.ciet-message-reply');
      if (replyButton) {
        recipient.value = replyButton.dataset.replyTo;
        parentInput.value = replyButton.dataset.parentId;
        replyNote.textContent = 'Replying to ' + replyButton.dataset.replyName;
        body.focus();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && widget.classList.contains('is-open')) {
        closeWidget();
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      setStatus('Sending...');
      const formData = new FormData(form);
      fetch(widget.dataset.sendUrl, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken(),
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
      })
        .then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok) throw data;
            return data;
          });
        })
        .then(function () {
          body.value = '';
          parentInput.value = '';
          replyNote.textContent = '';
          setStatus('Sent');
          loadInbox();
        })
        .catch(function (error) {
          setStatus(error && error.error ? error.error : 'Message not sent.');
        });
    });

    if (widget.dataset.unreadUrl) {
      fetch(widget.dataset.unreadUrl)
        .then(function (response) { return response.json(); })
        .then(function (data) { setBadges(data.unread_count || 0); })
        .catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMessaging);
  } else {
    initMessaging();
  }
})();
