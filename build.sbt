name    := "cystadium"
version := "0.1.0"
scalaVersion := "2.13.12"

val akkaVersion     = "2.6.21"
val akkaHttpVersion = "10.2.10"
val circeVersion    = "0.14.6"
val slickVersion    = "3.5.1"

libraryDependencies ++= Seq(
  // ── Akka ──────────────────────────────────────────────────────────────────
  "com.typesafe.akka" %% "akka-actor"          % akkaVersion,
  "com.typesafe.akka" %% "akka-stream"         % akkaVersion,
  "com.typesafe.akka" %% "akka-http"           % akkaHttpVersion,
  "com.typesafe.akka" %% "akka-http-spray-json"% akkaHttpVersion,

  // ── circe JSON ────────────────────────────────────────────────────────────
  "io.circe" %% "circe-core"           % circeVersion,
  "io.circe" %% "circe-generic"        % circeVersion,
  "io.circe" %% "circe-generic-extras" % "0.14.3",
  "io.circe" %% "circe-parser"         % circeVersion,
  "de.heikoseeberger" %% "akka-http-circe" % "1.39.2",

  // ── Base de données ───────────────────────────────────────────────────────
  "com.typesafe.slick" %% "slick"          % slickVersion,
  "com.typesafe.slick" %% "slick-hikaricp" % slickVersion,
  "org.postgresql"      % "postgresql"     % "42.7.3",

  // ── Config ────────────────────────────────────────────────────────────────
  "com.typesafe" % "config" % "1.4.3",

  // ── Hash de mots de passe ─────────────────────────────────────────────────
  "org.mindrot" % "jbcrypt" % "0.4",

  // ── Logging (SLF4J + simple backend) ──────────────────────────────────────
  "org.slf4j" % "slf4j-simple" % "2.0.13",

  // ── Tests ─────────────────────────────────────────────────────────────────
  "org.scalatest"     %% "scalatest"        % "3.2.18"   % Test,
  "com.typesafe.akka" %% "akka-testkit"        % akkaVersion % Test,
  "com.typesafe.akka" %% "akka-stream-testkit" % akkaVersion % Test,
  "com.typesafe.akka" %% "akka-http-testkit"   % akkaHttpVersion % Test,
)

scalacOptions += "-Ymacro-annotations"
