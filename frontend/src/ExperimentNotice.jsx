import React, { createContext, useContext, useRef } from 'react';
import { trackEvent } from './analytics.js';

const NoticeContext = createContext(null);

export function ExperimentNotice({ children }) {
  const dialog = useRef(null);

  return (
    <NoticeContext.Provider value={dialog}>
      {children}
      <dialog ref={dialog} className="experiment-notice" aria-labelledby="experiment-title"
        aria-describedby="experiment-description"
        onClick={event => { if (event.target === event.currentTarget) dialog.current.close(); }}>
        <div className="experiment-notice-content">
          <h2 id="experiment-title">Учебный эксперимент</h2>
          <p id="experiment-description">
            Этот учебный прототип демонстрирует идею акции. Он не является официальным сайтом
            или акцией РИВ ГОШ. Кнопки внешних сервисов работают в демонстрационном режиме.
          </p>
          <form method="dialog">
            <button type="submit" className="button button-dark">Понятно</button>
          </form>
        </div>
      </dialog>
    </NoticeContext.Provider>
  );
}

export function ExperimentButton({ children, eventKind, eventTarget, ...props }) {
  const dialog = useContext(NoticeContext);

  function open() {
    dialog.current.showModal();
    if (eventKind) trackEvent(eventKind, eventTarget ? { target: eventTarget } : undefined);
  }

  return <button {...props} type="button" aria-haspopup="dialog" onClick={open}>{children}</button>;
}
