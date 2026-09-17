-- DB Progetto - Social Media

CREATE DATABASE Progetto;
USE Progetto;

CREATE TABLE Utente (
                        idUtente        int auto_increment primary key,
                        Username        varchar(20)  not null unique,
                        Nome            varchar(20)  not null,
                        Cognome         varchar(20)  not null,
                        Email           varchar(100) not null unique,
                        DataN           date not null,
                        Nazionalita     varchar(20)  not null,
                        Pass            varchar(255) not null,   -- hash bcrypt (60 char) + margine
                        Pfp             blob not null,
                        Visibilita      enum('pubblico','privato','solo seguiti') not null default 'pubblico'
);

CREATE TABLE Tag (
                     idTag   int auto_increment primary key,
                     NomeT   varchar(100) not null unique
);

CREATE TABLE Post (
                      idPost      int auto_increment primary key,
                      FK_Utente   int not null,
                      Contenuto   text not null,
                      DataC       timestamp not null default current_timestamp,
                      foreign key (FK_Utente) references Utente(idUtente)
);


CREATE TABLE Post_Tag (
                          FK_Post int not null,
                          FK_Tag  int not null,
                          primary key (FK_Post, FK_Tag),
                          foreign key (FK_Post) references Post(idPost) on delete cascade,
                          foreign key (FK_Tag)  references Tag(idTag)   on delete cascade
);

CREATE TABLE Commento (
                          idCommento      int auto_increment primary key,
                          FK_Utente       int not null,
                          FK_Post         int null,
                          FK_Commento     int null,           -- risposta ad un altro commento
                          Contenuto       text not null,
                          DataC           timestamp not null default current_timestamp,
                          foreign key (FK_Utente)   references Utente(idUtente),
                          foreign key (FK_Post)     references Post(idPost)     on delete cascade,
                          foreign key (FK_Commento) references Commento(idCommento) on delete cascade
);

CREATE TABLE Likes (
                       idLike      int auto_increment primary key,
                       FK_Utente   int not null,
                       FK_Post     int null,
                       FK_Commento int null,
                       foreign key (FK_Utente)   references Utente(idUtente),
                       foreign key (FK_Post)     references Post(idPost)     on delete cascade,
                       foreign key (FK_Commento) references Commento(idCommento) on delete cascade,
                       unique (FK_Utente, FK_Post),
                       unique (FK_Utente, FK_Commento)
);

CREATE TABLE InterazioneUtenti (
                                   idInterazione   int auto_increment primary key,
                                   FK_UAzione      int not null,
                                   FK_USubisce     int not null,
                                   Interazione     enum('segue','bloccato') not null,
                                   foreign key (FK_UAzione)  references Utente(idUtente),
                                   foreign key (FK_USubisce) references Utente(idUtente),
                                   unique (FK_UAzione, FK_USubisce, Interazione)
);

CREATE TABLE SegueTag (
                          FK_Utente   int not null,
                          FK_Tag      int not null,
                          primary key (FK_Utente, FK_Tag),
                          foreign key (FK_Utente) references Utente(idUtente) on delete cascade,
                          foreign key (FK_Tag)    references Tag(idTag)       on delete cascade
);

CREATE TABLE Conversazione (
                               idConvo int auto_increment primary key,
                               FK_U1   int not null,
                               FK_U2   int not null,
                               foreign key (FK_U1) references Utente(idUtente),
                               foreign key (FK_U2) references Utente(idUtente),
                               unique (FK_U1, FK_U2)
);

CREATE TABLE Messaggio (
                           idMess      int auto_increment primary key,
                           FK_Mittente int not null,
                           FK_Convo    int not null,
                           Contenuto   text not null,
                           Emissione   timestamp not null default current_timestamp,
                           foreign key (FK_Mittente) references Utente(idUtente),
                           foreign key (FK_Convo)    references Conversazione(idConvo) on delete cascade
);
