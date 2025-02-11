import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BadgeDollarSign, BadgeHelpIcon, CogIcon, Loader2, RotateCcw, Sparkles, Trash, X } from 'lucide-react';
import { APIError, APIUserAbortError } from 'openai/error';
import { Link } from 'react-router-dom';

import { cn } from 'utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from 'components/ui/dialog';
import { Button } from 'components/ui/button';
import { UserContent } from 'components/UserContent/UserContent';
import { Card } from 'components/ui/card';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from 'components/ui/tooltip';
import { Input } from 'components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'components/ui/dropdown-menu';
import { DONATE_PATH, useDonateButton } from 'components/Footer/Footer.hooks';
import { AnimalEmoji } from 'components/AnimalEmoji/AnimalEmoji';
import { Checkbox } from 'components/ui/checkbox';
import { Label } from 'components/ui/label';
import { useErrorHandler } from 'hooks/useErrorHandler/useErrorHandler';
import { useLocalStorageState } from 'hooks/useLocalStorageState/useLocalStorageState';
import { useTrackEvent } from 'hooks/useTrackEvent/useTrackEvent';
import { Question } from 'validators/subjects';
import { AiTeacherResponseSchema, CorrectAnswersIndexSchema, ExplanationSchema } from 'validators/ai';
import { OpenAiModel, OpenAiToken, AiBaseUrl } from 'validators/localStorage';

import { Answer } from '../Answer/Answer';

import { QuestionAIAnswer, QuestionAIAnswerExplanation } from './QuestionAIAnswer';
import { getInstructorClient } from './QuestionAIChat.client';

const PROMPT = `
Remember if you do a good job, you will get a reward and a nice tip.

Below you will get a question. Which of the answers are correct?
Please describe all of the answers.
For correct answers describe why they are correct.
In case an answer is incorrect, also explain why.

Always use the same language for the output as the question and answers given by the user!
If the question is in English, answer in English. If the question is in Polish, answer in Polish.

Don't include the question in the response. Just the answers and explanations.
    `;

interface QuestionAIChatDialogProps {
  isOpen: boolean;
  closeModal: () => void;
  question: Question;
}
export const QuestionAIChatDialog = ({ isOpen, closeModal, question }: QuestionAIChatDialogProps) => {
  const trackEvent = useTrackEvent();
  useEffect(() => {
    if (isOpen) {
      trackEvent('GPTModal', 'Open');
    }
  }, [isOpen, trackEvent]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(willBeOpen) => {
        if (!willBeOpen) {
          closeModal();
        }
      }}
    >
      <DialogContent className="sm:max-h-[90%] top-[1rem] sm:top-[5%] data-[state=closed]:slide-out-to-top-[0.5rem] data-[state=open]:slide-in-from-top-[0.5rem] sm:data-[state=closed]:slide-out-to-top-[5%] sm:data-[state=open]:slide-in-from-top-[5%] translate-y-0 overflow-auto lg:max-w-[900px] md:max-w-[700px] md:w-full">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles width="1.5rem" height="1.5rem" absoluteStrokeWidth />
            Sprawdź z AI
          </DialogTitle>
        </DialogHeader>
        <QuestionAIChat question={question} />
      </DialogContent>
    </Dialog>
  );
};

interface QuestionAIChatProps {
  question: Question;
}

export const QuestionAIChat = ({ question }: QuestionAIChatProps) => {
  const [aiCorrectAnswers, setAICorrectAnswers] = useState<number[] | null>(null);
  const [openAiToken, setOpenAiToken, clearOpenAiToken] = useOpenAiToken();
  const [aiBaseUrl, setAiBaseUrl, clearAiBaseUrl] = useAiBaseUrl();

  return (
    <div className="flex flex-col min-w-0 gap-4">
      <QuestionPreview question={question} aiCorrectAnswers={aiCorrectAnswers} />
      {openAiToken != null && (
        <QuestionAIResponse
          question={question}
          openAiToken={openAiToken}
          clearAiBaseUrl={clearAiBaseUrl}
          clearOpenAiToken={clearOpenAiToken}
          aiCorrectAnswers={aiCorrectAnswers}
          setAICorrectAnswers={setAICorrectAnswers}
        />
      )}
      {openAiToken == null && (
        <OpenAiTokenInput setOpenAiToken={setOpenAiToken} setAiBaseUrl={setAiBaseUrl} aiBaseUrl={aiBaseUrl} />
      )}
    </div>
  );
};

interface OpenAiTokenInputProps {
  setAiBaseUrl: (value: string, saveForLater: boolean) => void;
  setOpenAiToken: (value: string, saveForLater: boolean) => void;
  aiBaseUrl: string;
}
const OpenAiTokenInput = ({ setOpenAiToken, setAiBaseUrl, aiBaseUrl }: OpenAiTokenInputProps) => {
  const trackEvent = useTrackEvent();
  const [currentToken, setCurrentToken] = useState('');
  const [savedForLater, setSavedForLater] = useState(true);
  const [currentBaseUrl, setCurrentBaseUrl] = useState(aiBaseUrl);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (currentToken.trim() === '' || currentBaseUrl.trim() === '') return;

      trackEvent('GPTModal', 'SetToken', 'SavedForLater', savedForLater ? 1 : 0);
      setAiBaseUrl(currentBaseUrl, savedForLater);
      setOpenAiToken(currentToken, savedForLater);
    },
    [currentToken, currentBaseUrl, savedForLater, setOpenAiToken, trackEvent],
  );

  return (
    <Card
      className="relative shadow-none p-4 w-full bg-gradient-to-br from-purple-50/50 to-purple-200/50 dark:from-purple-600/30 dark:to-purple-700/30 min-h-[3.25rem]"
      asChild
    >
      <form onSubmit={onSubmit}>
        <div className="flex w-full items-end gap-2">
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-sm font-medium leading-none flex items-center gap-1" htmlFor="openai-token">
              Klucz API OpenAI
              <Tooltip>
                <TooltipContent>Gdzie znajdę klucz API OpenAI?</TooltipContent>
                <TooltipTrigger asChild>
                  <a
                    href="https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <BadgeHelpIcon className="w-4 h-4" />
                  </a>
                </TooltipTrigger>
              </Tooltip>
            </label>
            <Input
              id="openai-token"
              value={currentToken}
              onChange={(e) => setCurrentToken(e.target.value)}
              className="col-span-3"
              type="text"
            />
            <label className="text-sm font-medium leading-none" htmlFor="openai-baseurl">
              Link do API OpenAI
            </label>
            <Input
              id="openai-baseurl"
              value={currentBaseUrl}
              onChange={(e) => setCurrentBaseUrl(e.target.value)}
              type="text"
              placeholder="https://api.openai.com"
            />
          </div>
          <Button disabled={currentToken.trim() === '' || currentBaseUrl.trim() === ''}>Zapisz</Button>
        </div>
        <div className="flex items-center space-x-2 col-span-3 mt-4">
          <Checkbox
            id="saveForLater"
            checked={savedForLater}
            onCheckedChange={(state) => {
              if (state === 'indeterminate') {
                return;
              }
              setSavedForLater(state);
            }}
          />
          <Label htmlFor="saveForLater" className="flex items-center">
            Zapisz między sesjami
            <Tooltip disableHoverableContent>
              <TooltipContent className="max-w-xs text-center">
                Klucz zostanie zapisany w localStorage i będzie dostępny w przyszłości.
                <br />
                Nie jest on zapisywany na serwerze zdaj.se i jest wykorzystywany tylko do bezpośredniej komunikacji z
                OpenAI.
              </TooltipContent>
              <TooltipTrigger className="ml-1">
                <BadgeHelpIcon className="w-4 h-4" />
              </TooltipTrigger>
            </Tooltip>
          </Label>
        </div>
      </form>
    </Card>
  );
};

const OpenAIModelsConfigurations = {
  'o3-mini': {
    name: 'o3 mini',
    description: 'Model przeprowadzający kroki rozumowania, dokładny, szybszy i tańszy od 4o.',
    pricing: 2,
  },
  'gpt-4o': {
    name: 'GPT-4o',
    description: 'Bardziej dokładny, lecz droższy. Dostępny w OpenAI API tylko dla płacących klientów.',
    pricing: 3,
  },
  'gpt-4o-mini': {
    name: 'GPT-4o mini',
    description: 'Mniej dokładny, ale tańszy od wszystkich innych modeli.',
    pricing: 1,
  },
};

interface QuestionAIResponseProps {
  question: Question;
  openAiToken: string;
  clearAiBaseUrl: () => void;
  clearOpenAiToken: () => void;
  aiCorrectAnswers: number[] | null;
  setAICorrectAnswers: (value: number[] | null) => void;
}

const QuestionAIResponse = ({
  question,
  setAICorrectAnswers,
  aiCorrectAnswers,
  openAiToken,
  clearOpenAiToken,
  clearAiBaseUrl,
}: QuestionAIResponseProps) => {
  const trackEvent = useTrackEvent();
  const [openAiModel, setOpenAiModel, clearStateOpenAiModel] = useLocalStorageState(OpenAiModel);
  const [openAiBaseUrl] = useAiBaseUrl();
  const [output, setOutput] = useState<Partial<AiTeacherResponseSchema>>({});
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'cancelled'>('idle');

  const abortControllerRef = useRef<AbortController | null>(null);

  const clearTokenAndBaseUrl = useCallback(() => {
    clearOpenAiToken();
    clearAiBaseUrl();
  }, [clearAiBaseUrl, clearOpenAiToken]);

  const errorHandler = useErrorHandler();
  const runAICompletion = useCallback(async () => {
    try {
      const abortController = new AbortController();
      abortControllerRef.current?.abort();
      abortControllerRef.current = abortController;
      const client = getInstructorClient(openAiToken, abortControllerRef.current.signal, 'JSON', openAiBaseUrl);

      if (status === 'working') {
        setStatus('cancelled');
        trackEvent('GPTModal', 'CancelAICompletion');
        return;
      }

      trackEvent('GPTModal', 'StartAICompletion');

      setStatus('working');
      setAICorrectAnswers(null);

      const answersString = question.answers.map((answer) => answer.answer).join('\n');
      const promptQuestion = question.question + '\n' + answersString;

      setOutput({});
      const stream = await client.chat.completions.create({
        model: openAiModel,
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: promptQuestion },
        ],
        response_model: {
          schema: AiTeacherResponseSchema,
          name: 'AiTeacherResponseSchema',
        },
        temperature: 0.25,
        n: 1,
        stream: true,
      });

      let wasPreambleUpdated = false;
      for await (const result of stream) {
        if (!wasPreambleUpdated) {
          const isPreambleDone =
            result._meta?._completedPaths?.some((path) => path[0] === 'correctAnswersIndex') &&
            result._meta._activePath?.[0] !== 'correctAnswersIndex';

          if (isPreambleDone) {
            const correctAnswersIndex = CorrectAnswersIndexSchema.safeParse(result.correctAnswersIndex);
            if (correctAnswersIndex.success) {
              setAICorrectAnswers(correctAnswersIndex.data);
            }

            wasPreambleUpdated = true;
          }
        }

        setOutput(result);
      }

      if (!abortController.signal.aborted) {
        setStatus('done');
      }
    } catch (error) {
      if (error instanceof APIUserAbortError) {
        setStatus('cancelled');
        return;
      } else if (error instanceof APIError) {
        errorHandler(error, 'OpenAI: ' + error.message);
      } else {
        errorHandler(error);
      }

      setStatus('idle');
    }
  }, [
    errorHandler,
    openAiModel,
    openAiToken,
    question.answers,
    question.question,
    setAICorrectAnswers,
    status,
    trackEvent,
  ]);

  useEffect(function cleanupActiveStream() {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const tooltip = useMemo(() => {
    if (status === 'working') {
      return 'Przerwij';
    }

    if (status === 'done' || status === 'cancelled') {
      return 'Sprawdź ponownie';
    }

    return undefined;
  }, [status]);

  const cardClassNames = cn(
    'relative shadow-none pr-2 sm:pr-4 pl-4 py-1 w-full bg-gradient-to-br from-purple-50/50 to-purple-200/50 dark:from-purple-600/30 dark:to-purple-700/30 min-h-[12rem]',
  );

  const onCheckedChange = (model: typeof openAiModel) => (isChecked: boolean) => {
    if (isChecked) {
      setOpenAiModel(model);
      trackEvent('GPTModal', 'ModelChangedTo-' + model);
    } else {
      clearStateOpenAiModel();
    }
  };

  const [isCustomModelDialogOpen, setIsCustomModelDialogOpen] = useState(false);
  const [customModel, setCustomModel] = useState('');

  const handleCustomModelSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (customModel.trim() === '') return;

      setOpenAiModel(customModel);
      setIsCustomModelDialogOpen(false);
    },
    [customModel, setOpenAiModel],
  );

  const isCustomSelected = useMemo(
    () => openAiModel != null && !Object.keys(OpenAIModelsConfigurations).includes(openAiModel),
    [openAiModel],
  );

  const optionsButton = (
    <DropdownMenu>
      <Tooltip>
        <TooltipPortal>
          <TooltipContent>Ustawienia OpenAI</TooltipContent>
        </TooltipPortal>
        <TooltipTrigger title="Ustawienia OpenAI" asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm">
              <CogIcon width="1rem" height="1rem" absoluteStrokeWidth />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
      </Tooltip>
      <DropdownMenuContent className="w-56" align="end" side="bottom">
        <DropdownMenuLabel>Model AI</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {Object.entries(OpenAIModelsConfigurations).map(([key, { name, description }]) => (
          <DropdownMenuCheckboxItem key={key} checked={openAiModel === key} onCheckedChange={onCheckedChange(key)}>
            {name}
            <Tooltip disableHoverableContent>
              <TooltipPortal>
                <TooltipContent>{description}</TooltipContent>
              </TooltipPortal>
              <TooltipTrigger asChild>
                <a
                  href="https://openai.com/api/pricing/"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 inline-flex"
                  onClick={(e) => e.stopPropagation()}
                >
                  {Array.from(
                    { length: OpenAIModelsConfigurations[key as keyof typeof OpenAIModelsConfigurations].pricing },
                    (_, i) => (
                      <BadgeDollarSign key={i} className="w-4 h-4" />
                    ),
                  )}
                </a>
              </TooltipTrigger>
            </Tooltip>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuCheckboxItem
          checked={!!isCustomSelected}
          onCheckedChange={(checked) => {
            if (checked) {
              setIsCustomModelDialogOpen(true);
            } else {
              clearStateOpenAiModel();
            }
          }}
        >
          Inny {isCustomSelected && `(${openAiModel})`}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={clearTokenAndBaseUrl}
          className="bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200 focus:bg-red-100 focus:text-red-900 data-[disabled]:opacity-50 dark:focus:bg-red-800 dark:focus:text-red-50"
        >
          <Trash className="mr-2 h-4 w-4" />
          Zmień klucz API OpenAI
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (status === 'idle' || (status === 'cancelled' && aiCorrectAnswers == null)) {
    return (
      <>
        <Card className={cn(cardClassNames)}>
          <QuestionAIAnswer
            lang="pl"
            correctExplanations={[]}
            incorrectExplanations={[]}
            aiCorrectAnswers={aiCorrectAnswers}
          />
          <div className="absolute top-0 left-0 rounded-lg overflow-hidden flex items-center justify-center w-full h-full backdrop-blur-sm bg-radial-gradient to-purple-50/50 from-purple-100 dark:from-purple-800/50 dark:to-purple-950/30">
            <Button
              variant="default"
              size="lg"
              onClick={runAICompletion}
              className="bg-gradient-to-tl text-white from-purple-500 to-purple-600 dark:from-purple-700 dark:to-purple-500"
            >
              <Sparkles width="1rem" height="1rem" className="mr-2" absoluteStrokeWidth />
              Sprawdź
            </Button>
            <div className="absolute top-2 right-2">{optionsButton}</div>
          </div>
        </Card>

        <Dialog open={isCustomModelDialogOpen} onOpenChange={setIsCustomModelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Wpisz model AI</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCustomModelSubmit}>
              <Input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="Nazwa modelu" />
              <div className="flex justify-end mt-4 gap-2">
                <Button type="button" onClick={() => setIsCustomModelDialogOpen(false)}>
                  Anuluj
                </Button>
                <Button type="submit">Zapisz</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const correctExplanations = (output.correctExplanations ?? []).map((e) =>
    mapExplanationToAIAnswerExplanation(e, question),
  );
  const incorrectExplanations = (output.incorrectExplanations ?? []).map((e) =>
    mapExplanationToAIAnswerExplanation(e, question),
  );

  return (
    <>
      <Card className={cardClassNames}>
        <div className="flex gap-2 absolute top-2 right-2">
          {status === 'done' && <DonateButton />}
          <Tooltip>
            <TooltipPortal>
              <TooltipContent>{tooltip}</TooltipContent>
            </TooltipPortal>
            <TooltipTrigger title={tooltip} asChild>
              <Button variant="outline" size="icon-sm" onClick={runAICompletion} className="group">
                {status === 'working' && (
                  <>
                    <Loader2
                      width="1rem"
                      height="1rem"
                      className="animate-spin group-hover:hidden"
                      absoluteStrokeWidth
                    />
                    <X width="1rem" height="1rem" className="hidden group-hover:block" />
                  </>
                )}
                {(status === 'done' || status === 'cancelled') && (
                  <RotateCcw width="1rem" height="1rem" absoluteStrokeWidth />
                )}
              </Button>
            </TooltipTrigger>
          </Tooltip>
          {status !== 'working' && optionsButton}
        </div>
        <QuestionAIAnswer
          lang={output.questionLanguage ?? 'unknown'}
          correctExplanations={correctExplanations}
          incorrectExplanations={incorrectExplanations}
          aiCorrectAnswers={aiCorrectAnswers}
        />
      </Card>

      <Dialog open={isCustomModelDialogOpen} onOpenChange={setIsCustomModelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wpisz model AI</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCustomModelSubmit}>
            <Input value={customModel} onChange={(e) => setCustomModel(e.target.value)} placeholder="Nazwa modelu" />
            <div className="flex justify-end mt-4 gap-2">
              <Button type="button" onClick={() => setIsCustomModelDialogOpen(false)}>
                Anuluj
              </Button>
              <Button type="submit">Zapisz</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface QuestionPreviewProps {
  question: Question;
  aiCorrectAnswers: number[] | null;
}
const QuestionPreview = ({ question, aiCorrectAnswers }: QuestionPreviewProps) => {
  return (
    <Card className="shadow-none">
      <header className="font-semibold flex-1 overflow-hidden w-full p-4">
        <UserContent isMarkdown={question.isMarkdown}>{question.question.trim().replace(/ - \(\d+\)/, '')}</UserContent>
      </header>
      <div className="w-full border-b" />
      <div>
        {question.answers.map((answer, i) => {
          return (
            <Fragment key={`${answer.answer}-${i}`}>
              {i > 0 && <div className="w-full border-b" />}
              <Answer
                answer={answer}
                showCorrect={false}
                userAnswer={aiCorrectAnswers?.includes(i) ?? false}
                showUserSelect={aiCorrectAnswers != null}
                disableUserSelect
                wasUserSelectCorrect
              />
            </Fragment>
          );
        })}
      </div>
    </Card>
  );
};

function mapExplanationToAIAnswerExplanation(
  explanation: ExplanationSchema,
  question: Question,
): QuestionAIAnswerExplanation {
  const answer = question.answers[explanation.answerIndex]?.answer;

  return {
    index: explanation.answerIndex,
    answer: answer ?? '',
    explanation: explanation.explanation,
  };
}

const DonateButton = () => {
  const { buttonProps, containerProps } = useDonateButton();

  return (
    <Tooltip>
      <TooltipPortal>
        <TooltipContent>Wspomóż</TooltipContent>
      </TooltipPortal>
      <TooltipTrigger title="Wspomóż" asChild>
        <div className="transition-transform" {...containerProps}>
          <Button asChild size="icon-sm" variant="outline" {...buttonProps}>
            <Link to={DONATE_PATH} className="text-xl">
              <AnimalEmoji />
              <span className="sr-only">Wspomóż</span>
            </Link>
          </Button>
        </div>
      </TooltipTrigger>
    </Tooltip>
  );
};

const useOpenAiToken = () => {
  const [lsOpenAiToken, lsSetOpenAiToken, lsClearOpenAiToken] = useLocalStorageState(OpenAiToken);
  const [savedForLater, setSavedForLater] = useState(lsOpenAiToken != null);
  const [localOpenAiToken, localSetOpenAiToken] = useState<string | null>(null);

  const openAiToken = useMemo(
    () => (savedForLater ? lsOpenAiToken : localOpenAiToken),
    [localOpenAiToken, lsOpenAiToken, savedForLater],
  );
  const setOpenAiToken = useCallback(
    (value: string, newSavedForLater?: boolean) => {
      if (newSavedForLater != null) {
        setSavedForLater(newSavedForLater);
      }
      const resolvedSavedForLater = newSavedForLater ?? savedForLater;

      if (resolvedSavedForLater) {
        lsSetOpenAiToken(value);
      } else {
        localSetOpenAiToken(value);
      }
    },
    [lsSetOpenAiToken, savedForLater],
  );
  const clearOpenAiToken = useCallback(() => {
    setSavedForLater(false);
    lsClearOpenAiToken();
    localSetOpenAiToken(null);
  }, [lsClearOpenAiToken]);

  return [openAiToken, setOpenAiToken, clearOpenAiToken] as const;
};

const useAiBaseUrl = () => {
  const [lsAiBaseUrl, lsSetAiBaseUrl, lsClearAiBaseUrl] = useLocalStorageState(AiBaseUrl);
  const [localAiBaseUrl, localSetAiBaseUrl] = useState<string | null>(lsAiBaseUrl);

  const aiBaseUrl = useMemo(() => localAiBaseUrl ?? lsAiBaseUrl, [localAiBaseUrl, lsAiBaseUrl]);
  const setAiBaseUrl = useCallback(
    (value: string) => {
      lsSetAiBaseUrl(value);
      localSetAiBaseUrl(value);
    },
    [lsSetAiBaseUrl],
  );
  const clearAiBaseUrl = useCallback(() => {
    lsClearAiBaseUrl();
    localSetAiBaseUrl(lsAiBaseUrl);
  }, [lsClearAiBaseUrl]);

  return [aiBaseUrl, setAiBaseUrl, clearAiBaseUrl] as const;
};
