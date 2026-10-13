import { emptyData, metadata, type AppData } from "./types";
import { localToday } from "./queries";

export function demoData(): AppData {
  const date = (offset: number) => {
    const value = new Date();
    value.setDate(value.getDate() + offset);
    return localToday(value);
  };
  const active = {
    ...metadata(),
    status: "Aktiv" as const,
    name: "Website überarbeiten",
    description:
      "Konzept, Inhalte und Veröffentlichung der persönlichen Website.",
  };
  const resting = {
    ...metadata(),
    status: "Abgeschlossen" as const,
    name: "Arbeitsplatz erneuern",
    description:
      "Abgeschlossenes Beispielprojekt – bleibt in der Projektliste erreichbar.",
  };
  return {
    ...emptyData(),
    nextProjectNumber: 3,
    projectCategories: [],
    projects: [
      { ...active, projectNumber: 1 },
      { ...resting, projectNumber: 2 },
    ],
    links: [
      {
        ...metadata(),
        projectId: active.id,
        label: "Projektunterlagen",
        target: "https://example.com",
      },
      {
        ...metadata(),
        projectId: resting.id,
        label: "Lokaler Projektordner",
        target: "C:\\Projekte\\Arbeitsplatz",
      },
    ],
    todos: [
      {
        ...metadata(),
        projectId: active.id,
        title: "Bestehende Inhalte sichten",
        completed: false,
        dueDate: date(-1),
      },
      {
        ...metadata(),
        projectId: active.id,
        title: "Entwurf besprechen",
        completed: false,
        doNext: true,
        dueDate: date(2),
      },
      {
        ...metadata(),
        projectId: active.id,
        title: "Ideen sammeln",
        completed: false,
      },
      {
        ...metadata(),
        projectId: resting.id,
        title: "Arbeitsplatz einrichten",
        completed: true,
        dueDate: date(-7),
      },
    ],
    events: [
      {
        ...metadata(),
        projectId: active.id,
        category: "Meeting",
        title: "Entwurf abstimmen",
        date: date(3),
        time: "10:00",
      },
      {
        ...metadata(),
        projectId: active.id,
        category: "Telefonat",
        title: "Rückmeldung zum Konzept",
        date: date(0),
        time: "09:00",
        note: "Klarere Navigation gewünscht.\nEntwurf beim nächsten Termin zeigen.",
      },
      {
        ...metadata(),
        projectId: active.id,
        category: "Milestone",
        title: "Konzept steht",
        date: date(-3),
      },
      {
        ...metadata(),
        projectId: active.id,
        category: "Beschluss",
        title: "Umfang festgelegt",
        date: date(-5),
        note: "Die erste Version konzentriert sich auf die wichtigsten Inhalte.",
      },
      {
        ...metadata(),
        projectId: active.id,
        category: "Notiz",
        title: "Ideen für die Startseite",
        date: date(0),
        note: "Großes Projektbild\nKurze Einleitung\nKontakt gut sichtbar",
      },
      {
        ...metadata(),
        projectId: resting.id,
        category: "Milestone",
        title: "Arbeitsplatz fertig",
        date: date(-7),
      },
    ],
  };
}
