import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS_SEMANA = [
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
];

type Categoria =
  | "Infantil"
  | "Fundamental";

type Turma = {
  id: string;
  nome: string;
  categoria: Categoria;
};

type Dados = Record<string, number | "">;

type Dia = {
  key: string;
  day: number;
  dow: number;
  date: Date;
};

type Semana = {
  mondayKey: string;
  mondayDate: Date;
  dias: Dia[];
  semana: number;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKey(
  y: number,
  m: number,
  d: number
): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function dateToKey(date: Date): string {
  return dateKey(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function todayKey(): string {
  const t = new Date();

  return dateToKey(t);
}

function formatDate(date: Date): string {
  return `${pad(date.getDate())}/${pad(
    date.getMonth() + 1
  )}`;
}

// =========================================================
// SEMANAS DO MÊS
// =========================================================
//
// Cada semana possui SEMPRE 5 dias:
// Segunda, Terça, Quarta, Quinta e Sexta.
//
// A semana pode começar no mês anterior ou terminar
// no mês seguinte.
//
// Exemplo:
//
// 31/08 | 01/09 | 02/09 | 03/09 | 04/09
//
// ou:
//
// 28/09 | 29/09 | 30/09 | 01/10 | 02/10
// =========================================================

function buildWeeks(
  year: number,
  month: number
): Semana[] {
  const firstDay = new Date(
    year,
    month,
    1
  );

  const lastDay = new Date(
    year,
    month + 1,
    0
  );

  // -------------------------------------------------------
  // Encontra a segunda-feira da primeira semana.
  //
  // Se o mês começar numa terça-feira, por exemplo,
  // a semana começa na segunda-feira do mês anterior.
  // -------------------------------------------------------

  const firstMonday = new Date(
    firstDay
  );

  const firstDow =
    firstMonday.getDay();

  if (firstDow === 0) {
    // Domingo -> volta 6 dias
    firstMonday.setDate(
      firstMonday.getDate() - 6
    );
  } else {
    // Segunda = 1
    // Terça = 2
    // ...
    // Sábado = 6
    firstMonday.setDate(
      firstMonday.getDate() -
        (firstDow - 1)
    );
  }

  // -------------------------------------------------------
  // Encontra a sexta-feira da última semana.
  // -------------------------------------------------------

  const lastFriday = new Date(
    lastDay
  );

  const lastDow =
    lastFriday.getDay();

  if (lastDow === 0) {
    // Domingo -> sexta foi 2 dias antes
    lastFriday.setDate(
      lastFriday.getDate() - 2
    );
  } else if (lastDow === 6) {
    // Sábado -> sexta foi 1 dia antes
    lastFriday.setDate(
      lastFriday.getDate() - 1
    );
  } else {
    // Segunda até sexta
    lastFriday.setDate(
      lastFriday.getDate() +
        (5 - lastDow)
    );
  }

  const weeks: Semana[] = [];

  let currentMonday =
    new Date(firstMonday);

  let numeroSemana = 1;

  while (
    currentMonday.getTime() <=
    lastFriday.getTime()
  ) {
    const dias: Dia[] = [];

    // -----------------------------------------------------
    // Sempre cria exatamente 5 dias.
    // -----------------------------------------------------

    for (let i = 0; i < 5; i++) {
      const date = new Date(
        currentMonday
      );

      date.setDate(
        currentMonday.getDate() + i
      );

      dias.push({
        key: dateToKey(date),
        day: date.getDate(),
        dow: date.getDay(),
        date,
      });
    }

    weeks.push({
      mondayKey: dateToKey(
        currentMonday
      ),
      mondayDate: new Date(
        currentMonday
      ),
      dias,
      semana: numeroSemana,
    });

    currentMonday.setDate(
      currentMonday.getDate() + 7
    );

    numeroSemana++;
  }

  return weeks;
}

// =========================================================
// CORES
// =========================================================

const COLORS = {
  white: "#FFFFFF",
  green: "#008A4B",
  greenLight: "#32AF77",
  yellow: "#FFE50A",
  orange: "#E94F24",
  text: "#1F2D26",
  textSoft: "#68756F",
  border: "#D9E2DD",
  background: "#F7FAF8",
  inputBackground: "#FFFFFF",
  danger: "#E94F24",
  shadow: "rgba(0, 0, 0, 0.10)",
};

// =========================================================
// COMPONENTE
// =========================================================

export default function FichaChamada() {
  const now = new Date();

  const [year, setYear] = useState<number>(
    now.getFullYear()
  );

  const [month, setMonth] = useState<number>(
    now.getMonth()
  );

  const [turmas, setTurmas] = useState<
    Turma[]
  >([]);

  const [dados, setDados] =
    useState<Dados>({});

  const [loaded, setLoaded] =
    useState(false);

  const [status, setStatus] =
    useState("");

  // -------------------------------------------------------
  // CONTROLE DA CONTAGEM
  // -------------------------------------------------------

  const [
    registrandoContagem,
    setRegistrandoContagem,
  ] = useState(false);

  // -------------------------------------------------------
  // MODAL
  // -------------------------------------------------------

  const [
    modalVisible,
    setModalVisible,
  ] = useState(false);

  const [
    modoEdicao,
    setModoEdicao,
  ] = useState(false);

  const [
    turmaEditandoId,
    setTurmaEditandoId,
  ] = useState<string | null>(null);

  const [
    nomeTurma,
    setNomeTurma,
  ] = useState("");

  const [
    categoriaTurma,
    setCategoriaTurma,
  ] =
    useState<Categoria>("Infantil");

  // -------------------------------------------------------
  // DADOS CALCULADOS
  // -------------------------------------------------------

  const monthKey = `${year}-${pad(
    month + 1
  )}`;

  const weeks = useMemo(
    () =>
      buildWeeks(
        year,
        month
      ),
    [year, month]
  );

  const hoje = todayKey();

  // =======================================================
  // CARREGAR DADOS
  // =======================================================

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoaded(false);

      // ---------------------------------------------------
      // CARREGA TURMAS
      // ---------------------------------------------------

      try {
        const savedTurmas =
          await AsyncStorage.getItem(
            "turmas"
          );

        if (
          savedTurmas &&
          !cancelled
        ) {
          setTurmas(
            JSON.parse(
              savedTurmas
            ) as Turma[]
          );
        } else if (!cancelled) {
          setTurmas([]);
        }
      } catch {
        if (!cancelled) {
          setTurmas([]);
        }
      }

      // ---------------------------------------------------
      // CARREGA TODAS AS CONTAGENS
      //
      // Agora usamos uma única chave.
      //
      // Isso é importante porque uma semana pode ter
      // dias pertencentes a meses diferentes.
      // ---------------------------------------------------

      try {
        const savedDados =
          await AsyncStorage.getItem(
            "chamada:dados"
          );

        if (
          savedDados &&
          !cancelled
        ) {
          setDados(
            JSON.parse(
              savedDados
            ) as Dados
          );
        } else if (!cancelled) {
          setDados({});
        }
      } catch {
        if (!cancelled) {
          setDados({});
        }
      }

      if (!cancelled) {
        setLoaded(true);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [monthKey]);

  // =======================================================
  // SALVAR TURMAS
  // =======================================================

  const salvarTurmas =
    useCallback(
      async (
        novaLista: Turma[]
      ) => {
        setTurmas(novaLista);

        try {
          await AsyncStorage.setItem(
            "turmas",
            JSON.stringify(
              novaLista
            )
          );

          setStatus(
            "Turmas salvas"
          );

          setTimeout(() => {
            setStatus("");
          }, 1200);
        } catch {
          setStatus(
            "Erro ao salvar turmas"
          );
        }
      },
      []
    );

  // =======================================================
  // SALVAR DADOS LOCALMENTE
  // =======================================================

  const salvarDadosLocal =
    useCallback(
      async (
        novoDados: Dados
      ) => {
        setDados(novoDados);

        try {
          await AsyncStorage.setItem(
            "chamada:dados",
            JSON.stringify(
              novoDados
            )
          );
        } catch {
          setStatus(
            "Erro ao salvar"
          );
        }
      },
      []
    );

  // =======================================================
  // REGISTRAR CONTAGEM
  // =======================================================

  function iniciarContagem() {
    setRegistrandoContagem(
      true
    );

    setStatus(
      "Modo de contagem ativado"
    );

    setTimeout(() => {
      setStatus("");
    }, 1500);
  }

  // =======================================================
  // SALVAR CONTAGEM
  // =======================================================

  async function salvarContagem() {
    /*
      FUTURO BACKEND:

      Aqui futuramente o AsyncStorage poderá ser
      substituído por um POST ou PUT.

      Exemplo:

      await fetch(
        "https://sua-api.com/api/contagens",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mes: monthKey,
            dados,
          }),
        }
      );

      Por enquanto usamos AsyncStorage.
    */

    await salvarDadosLocal(
      dados
    );

    setRegistrandoContagem(
      false
    );

    setStatus(
      "Contagem salva"
    );

    setTimeout(() => {
      setStatus("");
    }, 1500);
  }

  // =======================================================
  // ALTERAR NÚMERO
  // =======================================================

  function handleInput(
    turmaId: string,
    diaKey: string,
    valor: string
  ) {
    if (
      !registrandoContagem
    ) {
      return;
    }

    let num: number | "";

    if (valor === "") {
      num = "";
    } else {
      num = Math.max(
        0,
        parseInt(
          valor.replace(
            /\D/g,
            ""
          ),
          10
        ) || 0
      );
    }

    const chave = `${turmaId}|${diaKey}`;

    setDados(
      (anterior) => ({
        ...anterior,
        [chave]: num,
      })
    );
  }

  // =======================================================
  // TOTAL DO DIA
  // =======================================================

  function totalDia(
    diaKey: string
  ): number {
    return turmas.reduce(
      (acc, turma) => {
        return (
          acc +
          (Number(
            dados[
              `${turma.id}|${diaKey}`
            ]
          ) || 0)
        );
      },
      0
    );
  }

  // =======================================================
  // TOTAL DO DIA POR CATEGORIA
  // =======================================================

  function totalDiaCategoria(
    diaKey: string,
    categoria: Categoria
  ): number {
    return turmas.reduce(
      (acc, turma) => {
        if (
          turma.categoria !==
          categoria
        ) {
          return acc;
        }

        return (
          acc +
          (Number(
            dados[
              `${turma.id}|${diaKey}`
            ]
          ) || 0)
        );
      },
      0
    );
  }

  // =======================================================
  // TOTAL DA TURMA NA SEMANA
  // =======================================================

  function totalTurmaSemana(
    turmaId: string,
    week: Semana
  ): number {
    return week.dias.reduce(
      (acc, dia) =>
        acc +
        (Number(
          dados[
            `${turmaId}|${dia.key}`
          ]
        ) || 0),
      0
    );
  }

  // =======================================================
  // TOTAL DA SEMANA
  // =======================================================

  function totalSemana(
    week: Semana
  ): number {
    return week.dias.reduce(
      (acc, dia) =>
        acc +
        totalDia(dia.key),
      0
    );
  }

  // =======================================================
  // TOTAL DA SEMANA POR CATEGORIA
  // =======================================================

  function totalSemanaCategoria(
    week: Semana,
    categoria: Categoria
  ): number {
    return week.dias.reduce(
      (acc, dia) =>
        acc +
        totalDiaCategoria(
          dia.key,
          categoria
        ),
      0
    );
  }

  // =======================================================
  // VERIFICA SE A DATA PERTENCE AO MÊS ATUAL
  // =======================================================

  function pertenceAoMesAtual(
    diaKey: string
  ): boolean {
    return diaKey.startsWith(
      `${year}-${pad(month + 1)}`
    );
  }

  // =======================================================
  // TOTAL DO MÊS
  //
  // Importante:
  // As semanas possuem dias dos meses vizinhos, mas o
  // total mensal considera somente os dias pertencentes
  // ao mês atualmente selecionado.
  // =======================================================

  function totalMes(): number {
    return weeks.reduce(
      (acc, week) =>
        acc +
        week.dias.reduce(
          (
            semanaTotal,
            dia
          ) => {
            if (
              !pertenceAoMesAtual(
                dia.key
              )
            ) {
              return semanaTotal;
            }

            return (
              semanaTotal +
              totalDia(
                dia.key
              )
            );
          },
          0
        ),
      0
    );
  }

  // =======================================================
  // TOTAL POR CATEGORIA NO MÊS
  // =======================================================

  function totalCategoria(
    categoria: Categoria
  ): number {
    return Object.entries(
      dados
    ).reduce(
      (
        total,
        [chave, valor]
      ) => {
        const [
          turmaId,
          diaKey,
        ] = chave.split("|");

        const turma =
          turmas.find(
            (t) =>
              t.id === turmaId
          );

        if (
          turma &&
          turma.categoria ===
            categoria &&
          pertenceAoMesAtual(
            diaKey
          )
        ) {
          return (
            total +
            (Number(valor) || 0)
          );
        }

        return total;
      },
      0
    );
  }

  // =======================================================
  // CRIAR TURMA
  // =======================================================

  function abrirCriacao() {
    setModoEdicao(false);
    setTurmaEditandoId(null);
    setNomeTurma("");
    setCategoriaTurma(
      "Infantil"
    );
    setModalVisible(true);
  }

  // =======================================================
  // EDITAR TURMA
  // =======================================================

  function abrirEdicao(
    turma: Turma
  ) {
    setModoEdicao(true);
    setTurmaEditandoId(
      turma.id
    );
    setNomeTurma(
      turma.nome
    );
    setCategoriaTurma(
      turma.categoria
    );
    setModalVisible(true);
  }

  // =======================================================
  // SALVAR TURMA DO MODAL
  // =======================================================

  async function salvarTurmaModal() {
    const nome =
      nomeTurma.trim();

    if (!nome) {
      setStatus(
        "Digite o nome da turma"
      );
      return;
    }

    const nomeExiste =
      turmas.some(
        (turma) =>
          turma.nome.toLowerCase() ===
            nome.toLowerCase() &&
          turma.id !==
            turmaEditandoId
      );

    if (nomeExiste) {
      setStatus(
        "Essa turma já existe"
      );
      return;
    }

    if (
      modoEdicao &&
      turmaEditandoId
    ) {
      const novaLista =
        turmas.map(
          (turma) =>
            turma.id ===
            turmaEditandoId
              ? {
                  ...turma,
                  nome,
                  categoria:
                    categoriaTurma,
                }
              : turma
        );

      await salvarTurmas(
        novaLista
      );
    } else {
      const novaTurma: Turma = {
        id: `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`,
        nome,
        categoria:
          categoriaTurma,
      };

      await salvarTurmas([
        ...turmas,
        novaTurma,
      ]);
    }

    setModalVisible(false);
    setNomeTurma("");
    setTurmaEditandoId(null);
  }

  // =======================================================
  // REMOVER TURMA
  // =======================================================

  async function removeTurma(
    turmaId: string
  ) {
    const novaLista =
      turmas.filter(
        (turma) =>
          turma.id !== turmaId
      );

    await salvarTurmas(
      novaLista
    );
  }

  // =======================================================
  // MOVER TURMA PARA CIMA
  // =======================================================

  async function moverParaCima(
    index: number
  ) {
    if (index <= 0) {
      return;
    }

    const novaLista = [
      ...turmas,
    ];

    const anterior =
      novaLista[index - 1];

    novaLista[index - 1] =
      novaLista[index];

    novaLista[index] =
      anterior;

    await salvarTurmas(
      novaLista
    );
  }

  // =======================================================
  // MOVER TURMA PARA BAIXO
  // =======================================================

  async function moverParaBaixo(
    index: number
  ) {
    if (
      index >=
      turmas.length - 1
    ) {
      return;
    }

    const novaLista = [
      ...turmas,
    ];

    const proxima =
      novaLista[index + 1];

    novaLista[index + 1] =
      novaLista[index];

    novaLista[index] =
      proxima;

    await salvarTurmas(
      novaLista
    );
  }

  // =======================================================
  // MUDAR MÊS
  // =======================================================

  function mudarMes(
    delta: number
  ) {
    let m =
      month + delta;

    let y = year;

    if (m < 0) {
      m = 11;
      y -= 1;
    }

    if (m > 11) {
      m = 0;
      y += 1;
    }

    setMonth(m);
    setYear(y);
  }

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* ================================================= */}
        {/* CABEÇALHO */}
        {/* ================================================= */}

        <View
          style={styles.header}
        >
          <View
            style={
              styles.headerInfo
            }
          >
            <Text
              style={styles.title}
            >
              Ficha de Chamada
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Registro diário de
              refeições por turma
            </Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* NAVEGAÇÃO */}
        {/* ================================================= */}

        <View
          style={styles.toolbar}
        >
          <View
            style={
              styles.monthNav
            }
          >
            <Pressable
              style={
                styles.monthButton
              }
              onPress={() =>
                mudarMes(-1)
              }
            >
              <Text
                style={
                  styles.monthButtonText
                }
              >
                ‹
              </Text>
            </Pressable>

            <Text
              style={
                styles.monthLabel
              }
            >
              {MESES[month]}{" "}
              {year}
            </Text>

            <Pressable
              style={
                styles.monthButton
              }
              onPress={() =>
                mudarMes(1)
              }
            >
              <Text
                style={
                  styles.monthButtonText
                }
              >
                ›
              </Text>
            </Pressable>
          </View>

          {status ? (
            <Text
              style={styles.status}
            >
              {status}
            </Text>
          ) : null}
        </View>

        {/* ================================================= */}
        {/* AÇÕES */}
        {/* ================================================= */}

        <View
          style={
            styles.actionBar
          }
        >
          <View>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Turmas
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Organize e registre
              as turmas.
            </Text>
          </View>

          <View
            style={
              styles.actionButtons
            }
          >
            {!registrandoContagem ? (
              <Pressable
                style={
                  styles.countButton
                }
                onPress={
                  iniciarContagem
                }
              >
                <Text
                  style={
                    styles.countButtonText
                  }
                >
                  Registrar contagem
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={
                  styles.saveButton
                }
                onPress={
                  salvarContagem
                }
              >
                <Text
                  style={
                    styles.saveButtonText
                  }
                >
                  ✓ Salvar contagem
                </Text>
              </Pressable>
            )}

            <Pressable
              style={
                styles.addButton
              }
              onPress={
                abrirCriacao
              }
            >
              <Text
                style={
                  styles.addButtonText
                }
              >
                + Nova turma
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ================================================= */}
        {/* CARDS DAS TURMAS */}
        {/* ================================================= */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.turmasScrollContent
          }
        >
          {turmas.map(
            (
              turma,
              index
            ) => (
              <View
                key={turma.id}
                style={
                  styles.turmaCard
                }
              >
                <View
                  style={
                    styles.turmaCardTop
                  }
                >
                  <View
                    style={
                      styles.turmaCardInfo
                    }
                  >
                    <Text
                      style={
                        styles.turmaCardName
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {turma.nome}
                    </Text>

                    <View
                      style={[
                        styles.categoryBadge,
                        turma.categoria ===
                        "Infantil"
                          ? styles.categoryInfantil
                          : styles.categoryFundamental,
                      ]}
                    >
                      <Text
                        style={
                          styles.categoryBadgeText
                        }
                      >
                        {
                          turma.categoria
                        }
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() =>
                      abrirEdicao(
                        turma
                      )
                    }
                    style={
                      styles.editButton
                    }
                    hitSlop={8}
                  >
                    <Text
                      style={
                        styles.editButtonText
                      }
                    >
                      ✎
                    </Text>
                  </Pressable>
                </View>

                <View
                  style={
                    styles.turmaCardBottom
                  }
                >
                  <View
                    style={
                      styles.orderButtons
                    }
                  >
                    <Pressable
                      onPress={() =>
                        moverParaCima(
                          index
                        )
                      }
                      disabled={
                        index === 0
                      }
                      style={[
                        styles.arrowButton,
                        index ===
                          0 &&
                          styles.arrowDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.arrowText,
                          index ===
                            0 &&
                            styles.arrowDisabledText,
                        ]}
                      >
                        ↑
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        moverParaBaixo(
                          index
                        )
                      }
                      disabled={
                        index ===
                        turmas.length -
                          1
                      }
                      style={[
                        styles.arrowButton,
                        index ===
                          turmas.length -
                            1 &&
                          styles.arrowDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.arrowText,
                          index ===
                            turmas.length -
                              1 &&
                            styles.arrowDisabledText,
                        ]}
                      >
                        ↓
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={() =>
                      removeTurma(
                        turma.id
                      )
                    }
                    style={
                      styles.removeButton
                    }
                    hitSlop={8}
                  >
                    <Text
                      style={
                        styles.removeText
                      }
                    >
                      ×
                    </Text>
                  </Pressable>
                </View>
              </View>
            )
          )}

          {turmas.length ===
            0 && (
            <Pressable
              style={
                styles.emptyTurmaCard
              }
              onPress={
                abrirCriacao
              }
            >
              <Text
                style={
                  styles.emptyTurmaTitle
                }
              >
                Nenhuma turma
                cadastrada
              </Text>

              <Text
                style={
                  styles.emptyTurmaText
                }
              >
                Toque aqui para
                adicionar a primeira
                turma.
              </Text>
            </Pressable>
          )}
        </ScrollView>

        {/* ================================================= */}
        {/* RESUMO POR CATEGORIA */}
        {/* ================================================= */}

        <View
          style={
            styles.summaryContainer
          }
        >
          <View
            style={
              styles.summaryCard
            }
          >
            <View
              style={[
                styles.summaryIndicator,
                {
                  backgroundColor:
                    COLORS.greenLight,
                },
              ]}
            />

            <View>
              <Text
                style={
                  styles.summaryLabel
                }
              >
                Infantil
              </Text>

              <Text
                style={
                  styles.summaryValue
                }
              >
                {totalCategoria(
                  "Infantil"
                )}
              </Text>

              <Text
                style={
                  styles.summaryDescription
                }
              >
                Total do Infantil HOJE
              </Text>
            </View>
          </View>

          <View
            style={
              styles.summaryCard
            }
          >
            <View
              style={[
                styles.summaryIndicator,
                {
                  backgroundColor:
                    COLORS.green,
                },
              ]}
            />

            <View>
              <Text
                style={
                  styles.summaryLabel
                }
              >
                Fundamental
              </Text>

              <Text
                style={
                  styles.summaryValue
                }
              >
                {totalCategoria(
                  "Fundamental"
                )}
              </Text>

              <Text
                style={
                  styles.summaryDescription
                }
              >
                Total do Fundamental HOJE
              </Text>
            </View>
          </View>

          <View
            style={
              styles.summaryCard
            }
          >
            <View
              style={[
                styles.summaryIndicator,
                {
                  backgroundColor:
                    COLORS.orange,
                },
              ]}
            />

            <View>
              <Text
                style={
                  styles.summaryLabel
                }
              >
                Total geral
              </Text>

              <Text
                style={
                  styles.summaryValue
                }
              >
                {totalMes()}
              </Text>

              <Text
                style={
                  styles.summaryDescription
                }
              >
                Total de Todas as Turmas HOJE
              </Text>
            </View>
          </View>
        </View>

        {/* ================================================= */}
        {/* SEMANAS */}
        {/* ================================================= */}

        {weeks.map(
          (week) => (
            <View
              style={
                styles.semanaBloco
              }
              key={
                week.mondayKey
              }
            >
              {/* ----------------------------------------- */}
              {/* CABEÇALHO DA SEMANA */}
              {/* ----------------------------------------- */}

              <View
                style={
                  styles.semanaHeader
                }
              >
                <View>
                  <Text
                    style={
                      styles.semanaNumero
                    }
                  >
                    Semana{" "}
                    {week.semana}
                  </Text>

                  <Text
                    style={
                      styles.semanaDatas
                    }
                  >
                    {formatDate(
                      week.dias[0]
                        .date
                    )}
                    {" a "}
                    {formatDate(
                      week.dias[4]
                        .date
                    )}
                  </Text>
                </View>

                <View
                  style={
                    styles.weekTotal
                  }
                >
                  <Text
                    style={
                      styles.weekTotalLabel
                    }
                  >
                    Total
                  </Text>

                  <Text
                    style={
                      styles.weekTotalValue
                    }
                  >
                    {totalSemana(
                      week
                    )}
                  </Text>
                </View>
              </View>

              {/* ----------------------------------------- */}
              {/* TABELA */}
              {/* ----------------------------------------- */}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
              >
                <View
                  style={
                    styles.table
                  }
                >
                  {/* ===================================== */}
                  {/* CABEÇALHO */}
                  {/* ===================================== */}

                  <View
                    style={[
                      styles.row,
                      styles.headerRow,
                    ]}
                  >
                    <View
                      style={[
                        styles.cell,
                        styles.turmaCol,
                        styles.headerCell,
                      ]}
                    >
                      <Text
                        style={
                          styles.headerText
                        }
                      >
                        Turma
                      </Text>
                    </View>

                    {week.dias.map(
                      (dia) => {
                        const isToday =
                          dia.key ===
                          hoje;

                        return (
                          <View
                            key={
                              dia.key
                            }
                            style={[
                              styles.cell,
                              styles.dayCol,
                              styles.headerCell,
                              isToday &&
                                styles.todayCell,
                            ]}
                          >
                            <Text
                              style={[
                                styles.headerText,
                                isToday &&
                                  styles.todayText,
                              ]}
                            >
                              {
                                DIAS_SEMANA[
                                  dia.dow -
                                    1
                                ]
                              }
                            </Text>

                            <Text
                              style={[
                                styles.headerDate,
                                isToday &&
                                  styles.todayText,
                              ]}
                            >
                              {pad(
                                dia.day
                              )}
                              /
                              {pad(
                                dia.date.getMonth() +
                                  1
                              )}
                            </Text>
                          </View>
                        );
                      }
                    )}
                  </View>

                  {/* ===================================== */}
                  {/* LINHAS DAS TURMAS */}
                  {/* ===================================== */}

                  {turmas.map(
                    (turma) => (
                      <View
                        style={
                          styles.row
                        }
                        key={
                          turma.id
                        }
                      >
                        <View
                          style={[
                            styles.cell,
                            styles.turmaCol,
                          ]}
                        >
                          <View
                            style={
                              styles.turmaTableInfo
                            }
                          >
                            <Text
                              style={
                                styles.turmaText
                              }
                              numberOfLines={
                                1
                              }
                            >
                              {
                                turma.nome
                              }
                            </Text>

                            <Text
                              style={
                                styles.turmaCategory
                              }
                            >
                              {
                                turma.categoria
                              }
                            </Text>
                          </View>
                        </View>

                        {week.dias.map(
                          (dia) => {
                            const isToday =
                              dia.key ===
                              hoje;

                            const value =
                              dados[
                                `${turma.id}|${dia.key}`
                              ];

                            return (
                              <View
                                key={
                                  dia.key
                                }
                                style={[
                                  styles.cell,
                                  styles.dayCol,
                                  isToday &&
                                    styles.todayCell,
                                ]}
                              >
                                <TextInput
                                  value={
                                    value ===
                                    undefined
                                      ? ""
                                      : String(
                                          value
                                        )
                                  }
                                  onChangeText={(
                                    text
                                  ) =>
                                    handleInput(
                                      turma.id,
                                      dia.key,
                                      text
                                    )
                                  }
                                  placeholder="—"
                                  placeholderTextColor="#A4AEA9"
                                  keyboardType="number-pad"
                                  editable={
                                    loaded &&
                                    registrandoContagem
                                  }
                                  style={[
                                    styles.numberInput,
                                    !registrandoContagem &&
                                      styles.numberInputDisabled,
                                  ]}
                                />
                              </View>
                            );
                          }
                        )}
                      </View>
                    )
                  )}

                  {/* ===================================== */}
                  {/* TOTAL DO DIA */}
                  {/* ===================================== */}

                  <View
                    style={[
                      styles.row,
                      styles.totalRow,
                    ]}
                  >
                    <View
                      style={[
                        styles.cell,
                        styles.turmaCol,
                      ]}
                    >
                      <Text
                        style={
                          styles.totalDayText
                        }
                      >
                        Total do dia
                      </Text>
                    </View>

                    {week.dias.map(
                      (dia) => {
                        const isToday =
                          dia.key ===
                          hoje;

                        return (
                          <View
                            key={
                              dia.key
                            }
                            style={[
                              styles.cell,
                              styles.dayCol,
                              isToday &&
                                styles.todayCell,
                            ]}
                          >
                            <Text
                              style={
                                styles.totalDayText
                              }
                            >
                              {totalDia(
                                dia.key
                              )}
                            </Text>
                          </View>
                        );
                      }
                    )}
                  </View>

                  {/* ===================================== */}
                  {/* TOTAL INFANTIL */}
                  {/* ===================================== */}

                  <View
                    style={[
                      styles.row,
                      styles.categoryTotalRow,
                    ]}
                  >
                    <View
                      style={[
                        styles.cell,
                        styles.turmaCol,
                      ]}
                    >
                      <Text
                        style={
                          styles.categoryTotalLabel
                        }
                      >
                        Total Infantil
                      </Text>
                    </View>

                    {week.dias.map(
                      (dia) => {
                        const isToday =
                          dia.key ===
                          hoje;

                        return (
                          <View
                            key={
                              dia.key
                            }
                            style={[
                              styles.cell,
                              styles.dayCol,
                              isToday &&
                                styles.todayCell,
                            ]}
                          >
                            <Text
                              style={
                                styles.categoryTotalText
                              }
                            >
                              {totalDiaCategoria(
                                dia.key,
                                "Infantil"
                              )}
                            </Text>
                          </View>
                        );
                      }
                    )}
                  </View>

                  {/* ===================================== */}
                  {/* TOTAL FUNDAMENTAL */}
                  {/* ===================================== */}

                  <View
                    style={[
                      styles.row,
                      styles.categoryTotalRow,
                    ]}
                  >
                    <View
                      style={[
                        styles.cell,
                        styles.turmaCol,
                      ]}
                    >
                      <Text
                        style={
                          styles.categoryTotalLabel
                        }
                      >
                        Total Fundamental
                      </Text>
                    </View>

                    {week.dias.map(
                      (dia) => {
                        const isToday =
                          dia.key ===
                          hoje;

                        return (
                          <View
                            key={
                              dia.key
                            }
                            style={[
                              styles.cell,
                              styles.dayCol,
                              isToday &&
                                styles.todayCell,
                            ]}
                          >
                            <Text
                              style={
                                styles.categoryTotalText
                              }
                            >
                              {totalDiaCategoria(
                                dia.key,
                                "Fundamental"
                              )}
                            </Text>
                          </View>
                        );
                      }
                    )}
                  </View>
                </View>
              </ScrollView>
            </View>
          )
        )}

        {/* ================================================= */}
        {/* RODAPÉ */}
        {/* ================================================= */}

        <View
          style={
            styles.rodapeMes
          }
        >
          <View>
            <Text
              style={
                styles.rodapeLabel
              }
            >
              Total geral
            </Text>

            <Text
              style={
                styles.rodapeMonth
              }
            >
              {MESES[month]} /{" "}
              {year}
            </Text>
          </View>

          <Text
            style={
              styles.rodapeNum
            }
          >
            {totalMes()}
          </Text>
        </View>

        <Text
          style={styles.aviso}
        >
          Os dados desta ficha ficam
          salvos neste dispositivo.
          O botão "Salvar contagem"
          poderá ser conectado ao
          banco de dados posteriormente.
        </Text>
      </ScrollView>

      {/* =================================================== */}
      {/* MODAL — CRIAR / EDITAR TURMA */}
      {/* =================================================== */}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setModalVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            {/* --------------------------------------------- */}
            {/* CABEÇALHO DO MODAL */}
            {/* --------------------------------------------- */}

            <View
              style={
                styles.modalHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  {modoEdicao
                    ? "Editar turma"
                    : "Nova turma"}
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  Preencha os dados
                  da turma.
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  setModalVisible(
                    false
                  )
                }
                style={
                  styles.modalClose
                }
              >
                <Text
                  style={
                    styles.modalCloseText
                  }
                >
                  ×
                </Text>
              </Pressable>
            </View>

            {/* --------------------------------------------- */}
            {/* NOME */}
            {/* --------------------------------------------- */}

            <View
              style={
                styles.formGroup
              }
            >
              <Text
                style={
                  styles.formLabel
                }
              >
                Nome
              </Text>

              <TextInput
                value={nomeTurma}
                onChangeText={
                  setNomeTurma
                }
                placeholder="Ex.: 1º Fase A"
                placeholderTextColor="#9AA59F"
                style={
                  styles.formInput
                }
                autoFocus
              />
            </View>

            {/* --------------------------------------------- */}
            {/* CATEGORIA */}
            {/* --------------------------------------------- */}

            <View
              style={
                styles.formGroup
              }
            >
              <Text
                style={
                  styles.formLabel
                }
              >
                Categoria
              </Text>

              <View
                style={
                  styles.categoryOptions
                }
              >
                {/* INFANTIL */}

                <Pressable
                  onPress={() =>
                    setCategoriaTurma(
                      "Infantil"
                    )
                  }
                  style={[
                    styles.categoryOption,
                    categoriaTurma ===
                      "Infantil" &&
                      styles.categoryOptionSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      categoriaTurma ===
                        "Infantil" &&
                        styles.radioSelected,
                    ]}
                  />

                  <View>
                    <Text
                      style={
                        styles.categoryOptionTitle
                      }
                    >
                      Infantil
                    </Text>

                    <Text
                      style={
                        styles.categoryOptionDescription
                      }
                    >
                      1º Fase até
                      2º Fase
                    </Text>
                  </View>
                </Pressable>

                {/* FUNDAMENTAL */}

                <Pressable
                  onPress={() =>
                    setCategoriaTurma(
                      "Fundamental"
                    )
                  }
                  style={[
                    styles.categoryOption,
                    categoriaTurma ===
                      "Fundamental" &&
                      styles.categoryOptionSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      categoriaTurma ===
                        "Fundamental" &&
                        styles.radioSelected,
                    ]}
                  />

                  <View>
                    <Text
                      style={
                        styles.categoryOptionTitle
                      }
                    >
                      Fundamental
                    </Text>

                    <Text
                      style={
                        styles.categoryOptionDescription
                      }
                    >
                      1º Ano até
                      5º Ano
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* --------------------------------------------- */}
            {/* BOTÕES */}
            {/* --------------------------------------------- */}

            <View
              style={
                styles.modalActions
              }
            >
              <Pressable
                onPress={() =>
                  setModalVisible(
                    false
                  )
                }
                style={
                  styles.cancelButton
                }
              >
                <Text
                  style={
                    styles.cancelButtonText
                  }
                >
                  Cancelar
                </Text>
              </Pressable>

              <Pressable
                onPress={
                  salvarTurmaModal
                }
                style={
                  styles.modalSaveButton
                }
              >
                <Text
                  style={
                    styles.modalSaveButtonText
                  }
                >
                  {modoEdicao
                    ? "Salvar alterações"
                    : "Criar turma"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// =========================================================
// ESTILOS
// =========================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  root: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  content: {
    padding: 20,
    paddingBottom: 70,
  },

  // =======================================================
  // HEADER
  // =======================================================

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 20,
    paddingBottom: 18,
    borderBottomWidth: 3,
    borderBottomColor:
      COLORS.green,
    marginBottom: 20,
  },

  headerInfo: {
    flex: 1,
  },

  title: {
    color: COLORS.green,
    fontSize: 28,
    fontWeight: "800",
  },

  subtitle: {
    color: COLORS.textSoft,
    fontSize: 12,
    marginTop: 5,
  },

  // =======================================================
  // TOOLBAR
  // =======================================================

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },

  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor:
      COLORS.white,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },

  monthButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent:
      "center",
    borderRadius: 6,
  },

  monthButtonText: {
    color: COLORS.green,
    fontSize: 26,
    lineHeight: 28,
    fontWeight: "600",
  },

  monthLabel: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    minWidth: 145,
    textAlign: "center",
  },

  status: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: "600",
  },

  // =======================================================
  // AÇÕES
  // =======================================================

  actionBar: {
    backgroundColor:
      COLORS.white,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 15,
    flexWrap: "wrap",
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
  },

  sectionSubtitle: {
    color: COLORS.textSoft,
    fontSize: 11,
    marginTop: 3,
  },

  actionButtons: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },

  countButton: {
    backgroundColor:
      COLORS.yellow,
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  countButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  saveButton: {
    backgroundColor:
      COLORS.green,
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  saveButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "800",
  },

  addButton: {
    backgroundColor:
      COLORS.green,
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  addButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },

  // =======================================================
  // CARDS DAS TURMAS
  // =======================================================

  turmasScrollContent: {
    gap: 10,
    paddingBottom: 20,
  },

  turmaCard: {
    width: 205,
    backgroundColor:
      COLORS.white,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 10,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 2,
  },

  turmaCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent:
      "space-between",
    gap: 5,
  },

  turmaCardInfo: {
    flex: 1,
  },

  turmaCardName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },

  categoryBadge: {
    alignSelf: "flex-start",
    marginTop: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },

  categoryInfantil: {
    backgroundColor:
      "#E5F7EE",
  },

  categoryFundamental: {
    backgroundColor:
      "#EAF5EF",
  },

  categoryBadgeText: {
    color: COLORS.green,
    fontSize: 9,
    fontWeight: "800",
    textTransform:
      "uppercase",
  },

  editButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent:
      "center",
    borderRadius: 6,
    backgroundColor:
      "#F2F6F4",
  },

  editButtonText: {
    color: COLORS.green,
    fontSize: 17,
    fontWeight: "700",
  },

  turmaCardBottom: {
    marginTop: 14,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor:
      COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  orderButtons: {
    flexDirection: "row",
    gap: 5,
  },

  arrowButton: {
    width: 32,
    height: 30,
    alignItems: "center",
    justifyContent:
      "center",
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 6,
    backgroundColor:
      COLORS.white,
  },

  arrowText: {
    color: COLORS.green,
    fontSize: 17,
    fontWeight: "800",
  },

  arrowDisabled: {
    opacity: 0.35,
  },

  arrowDisabledText: {
    color: COLORS.textSoft,
  },

  removeButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent:
      "center",
  },

  removeText: {
    color: COLORS.orange,
    fontSize: 22,
    lineHeight: 24,
  },

  emptyTurmaCard: {
    width: 260,
    minHeight: 100,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor:
      COLORS.greenLight,
    borderRadius: 10,
    alignItems: "center",
    justifyContent:
      "center",
    padding: 15,
    backgroundColor:
      COLORS.white,
  },

  emptyTurmaTitle: {
    color: COLORS.green,
    fontWeight: "800",
    fontSize: 13,
  },

  emptyTurmaText: {
    color: COLORS.textSoft,
    fontSize: 10,
    marginTop: 5,
    textAlign: "center",
  },

  // =======================================================
  // RESUMO
  // =======================================================

  summaryContainer: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 22,
  },

  summaryCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor:
      COLORS.white,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  summaryIndicator: {
    width: 5,
    height: 55,
    borderRadius: 4,
  },

  summaryLabel: {
    color: COLORS.textSoft,
    fontSize: 11,
    fontWeight: "700",
    textTransform:
      "uppercase",
  },

  summaryValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },

  summaryDescription: {
    color: COLORS.textSoft,
    fontSize: 11,
  },

  // =======================================================
  // SEMANA
  // =======================================================

  semanaBloco: {
    backgroundColor:
      COLORS.white,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 12,
    marginBottom: 20,
    overflow: "hidden",
  },

  semanaHeader: {
    minHeight: 65,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    borderBottomWidth: 2,
    borderBottomColor:
      COLORS.green,
  },

  semanaNumero: {
    color: COLORS.green,
    fontSize: 15,
    fontWeight: "800",
  },

  semanaDatas: {
    color: COLORS.textSoft,
    fontSize: 10,
    marginTop: 3,
  },

  weekTotal: {
    alignItems: "flex-end",
  },

  weekTotalLabel: {
    color: COLORS.textSoft,
    fontSize: 9,
    textTransform:
      "uppercase",
  },

  weekTotalValue: {
    color: COLORS.orange,
    fontSize: 18,
    fontWeight: "800",
  },

  // =======================================================
  // TABELA
  // =======================================================

  table: {
    minWidth: 535,
  },

  row: {
    flexDirection: "row",
  },

  headerRow: {
    backgroundColor:
      "#F3F7F5",
  },

  cell: {
    minHeight: 56,
    borderTopWidth: 1,
    borderTopColor:
      COLORS.border,
    paddingHorizontal: 8,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent:
      "center",
  },

  headerCell: {
    borderTopWidth: 0,
    minHeight: 62,
  },

  turmaCol: {
    width: 145,
    alignItems: "flex-start",
  },

  dayCol: {
    width: 78,
  },

  headerText: {
    color: COLORS.textSoft,
    fontSize: 9,
    fontWeight: "800",
    textTransform:
      "uppercase",
    textAlign: "center",
  },

  headerDate: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },

  turmaTableInfo: {
    flex: 1,
  },

  turmaText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
  },

  turmaCategory: {
    color: COLORS.textSoft,
    fontSize: 8,
    marginTop: 2,
  },

  numberInput: {
    width: 48,
    height: 34,
    textAlign: "center",
    borderWidth: 1,
    borderColor:
      COLORS.greenLight,
    borderRadius: 6,
    backgroundColor:
      COLORS.white,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 3,
  },

  numberInputDisabled: {
    borderColor:
      COLORS.border,
    backgroundColor:
      "#F5F7F6",
    color: COLORS.textSoft,
  },

  todayCell: {
    backgroundColor:
      "#FFFBE0",
  },

  todayText: {
    color: COLORS.orange,
  },

  // =======================================================
  // TOTAL DO DIA
  // =======================================================

  totalRow: {
    borderTopWidth: 2,
    borderTopColor:
      COLORS.green,
    backgroundColor:
      "#F8FAF9",
  },

  totalDayText: {
    color: COLORS.orange,
    fontSize: 12,
    fontWeight: "800",
  },

  // =======================================================
  // TOTAIS POR CATEGORIA
  // =======================================================

  categoryTotalRow: {
    backgroundColor:
      "#F3F7F5",
  },

  categoryTotalLabel: {
    color: COLORS.green,
    fontSize: 10,
    fontWeight: "800",
  },

  categoryTotalText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  // =======================================================
  // RODAPÉ
  // =======================================================

  rodapeMes: {
    marginTop: 5,
    paddingTop: 16,
    borderTopWidth: 3,
    borderTopColor:
      COLORS.green,
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
  },

  rodapeLabel: {
    color: COLORS.textSoft,
    fontSize: 10,
    textTransform:
      "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
  },

  rodapeMonth: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },

  rodapeNum: {
    color: COLORS.orange,
    fontSize: 28,
    fontWeight: "900",
  },

  aviso: {
    color: COLORS.textSoft,
    fontSize: 10,
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor:
      COLORS.border,
    paddingTop: 10,
    lineHeight: 16,
  },

  // =======================================================
  // MODAL
  // =======================================================

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent:
      "center",
    padding: 20,
  },

  modalCard: {
    width: "100%",
    maxWidth: 480,
    backgroundColor:
      COLORS.white,
    borderRadius: 14,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 10,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems:
      "flex-start",
    marginBottom: 24,
  },

  modalTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "800",
  },

  modalSubtitle: {
    color: COLORS.textSoft,
    fontSize: 11,
    marginTop: 4,
  },

  modalClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent:
      "center",
    backgroundColor:
      "#F2F5F3",
    borderRadius: 7,
  },

  modalCloseText: {
    color: COLORS.textSoft,
    fontSize: 22,
    lineHeight: 24,
  },

  // =======================================================
  // FORM
  // =======================================================

  formGroup: {
    marginBottom: 20,
  },

  formLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 7,
  },

  formInput: {
    height: 46,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor:
      COLORS.white,
    color: COLORS.text,
    fontSize: 13,
  },

  categoryOptions: {
    gap: 8,
  },

  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 8,
    padding: 12,
  },

  categoryOptionSelected: {
    borderColor:
      COLORS.green,
    backgroundColor:
      "#F0F9F4",
  },

  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor:
      COLORS.border,
  },

  radioSelected: {
    borderColor:
      COLORS.green,
    backgroundColor:
      COLORS.green,
  },

  categoryOptionTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },

  categoryOptionDescription: {
    color: COLORS.textSoft,
    fontSize: 9,
    marginTop: 2,
  },

  // =======================================================
  // MODAL ACTIONS
  // =======================================================

  modalActions: {
    flexDirection: "row",
    justifyContent:
      "flex-end",
    gap: 8,
    marginTop: 5,
  },

  cancelButton: {
    borderWidth: 1,
    borderColor:
      COLORS.border,
    borderRadius: 7,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },

  cancelButtonText: {
    color: COLORS.textSoft,
    fontSize: 11,
    fontWeight: "700",
  },

  modalSaveButton: {
    backgroundColor:
      COLORS.green,
    borderRadius: 7,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  modalSaveButtonText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "800",
  },
});
