package cystadium.db

import slick.jdbc.PostgresProfile.api._

object Database {
  lazy val db: slick.jdbc.PostgresProfile.backend.Database =
    slick.jdbc.PostgresProfile.api.Database.forConfig("cystadium.database")

  def close(): Unit = db.close()
}
