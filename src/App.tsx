import { useState } from 'react';
import { Router, Switch, Route } from 'react-router-dom';

import { IndexPage } from 'views/IndexPage/IndexPage';
import { CookiePolicy } from 'views/CookiePolicy/CookiePolicy';
import { DonatePage } from 'views/DonatePage/DonatePage';
import { BugsDataChange } from 'views/BugsDataChange/BugsDataChange';
import { SubjectAllQuestions } from 'views/SubjectAllQuestions/SubjectAllQuestions';
import { Exam } from 'views/Exam/Exam';

import { piwik, useAnalytics } from 'hooks/useAnalytics/useAnalytics';

import { Footer } from 'components/Footer/Footer';
import { CookieNotice } from 'components/CookieNotice/CookieNotice';
import { AnalyticsContext } from 'components/AnalyticsContext/AnalyticsContext';
import { RelCanonical } from 'components/RelCanonical/RelCanonical';
import { UpdatedAtContext } from 'hooks/useUpdatedAt/useUpdatedAt';

import { EditQuestionModal } from 'components/EditQuestionModal/EditQuestionModal';
import { EditQuestionModalProvider } from 'components/EditQuestionModal/EditQuestionModal.context';
import { ThemeProvider } from 'components/ThemeProvider/ThemeProvider';
import { AnimalEmojiProvider } from 'components/AnimalEmoji/AnimalEmoji';
import { TooltipProvider } from 'components/ui/tooltip';
import { Toaster } from 'components/ui/toaster';
import { history } from './customHistory';

export const App = () => {
  const { areCookiesAccepted, onBannerClose } = useAnalytics();
  const [updatedAt, setUpdatedAt] = useState<number | undefined>();

  return (
    <UpdatedAtContext.Provider value={{ updatedAt, setUpdatedAt }}>
      <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
        <EditQuestionModalProvider>
          <TooltipProvider delayDuration={400}>
            <AnalyticsContext.Provider value={piwik}>
              <div className="max-w-3xl mx-auto font-normal">
                <Router
                  history={piwik ? piwik.connectToHistory(history) : history}
                >
                  <AnimalEmojiProvider>
                    <RelCanonical />
                    <CookieNotice
                      onBannerClose={onBannerClose}
                      areCookiesAccepted={areCookiesAccepted}
                    />
                    <Switch>
                      <Route path="/" exact component={IndexPage} />
                      <Route path="/donate" exact component={DonatePage} />
                      <Route
                        path="/polityka-cookies"
                        exact
                        component={CookiePolicy}
                      />
                      <Route
                        path="/bledy-zmiany-w-danych"
                        exact
                        component={BugsDataChange}
                      />
                      <Route path="/:subjectId/exam" component={Exam} />
                      <Route
                        path="/:subjectId"
                        exact
                        component={SubjectAllQuestions}
                      />
                    </Switch>
                    <Footer updatedAt={updatedAt} />
                  </AnimalEmojiProvider>
                  <Toaster />
                </Router>
              </div>
              <EditQuestionModal />
            </AnalyticsContext.Provider>
          </TooltipProvider>
        </EditQuestionModalProvider>
      </ThemeProvider>
    </UpdatedAtContext.Provider>
  );
};
